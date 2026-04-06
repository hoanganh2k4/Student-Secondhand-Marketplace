"""
api/main.py
FastAPI service — per-stage endpoints + full pipeline.

Stage 0  (luôn sẵn sàng, không cần index):
    POST /stage0/parse          — full ParsedQuery: hard constraints + soft preferences
    POST /stage0/keywords       — KeyBERT keywords only (nhanh hơn, dùng cho autocomplete)

Stage 1  (cần pipeline):
    POST /stage1/route          — xem category routing decision cho một query

Stage 2  (cần pipeline):
    POST /stage2/retrieve       — retrieval candidates trước khi rerank

Stage 3 / Full pipeline:
    POST /search                — stages 0 → 1 → 2 → 3, kết quả cuối cùng

System:
    GET  /health
    GET  /stats
    POST /index/rebuild
"""
from __future__ import annotations

import os
import time
from contextlib import asynccontextmanager
from typing import Any

import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from src.pipeline import MultiStagePipeline
from src.pipeline.stage0 import QueryParser, normalize_query, extract_keywords
from src.utils import load_config, get_logger, get_device

logger = get_logger("api")


# ── State ─────────────────────────────────────────────────────────────────────

pipeline:     MultiStagePipeline | None = None
query_parser: QueryParser | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global pipeline, query_parser
    cfg    = load_config(os.getenv("CONFIG_PATH", "configs/config.yaml"))
    device = get_device()
    logger.info(f"Starting API on device: {device}")

    # Stage 0 — luôn load, không cần index
    try:
        query_parser = QueryParser(kw_top_n=int(os.getenv("KW_TOP_N", "6")))
        query_parser.parse("warmup")
        logger.info("QueryParser ready.")
    except Exception as e:
        logger.error(f"QueryParser load failed: {e}")

    # Stages 1-3 — cần FAISS index
    try:
        pipeline = MultiStagePipeline.from_config(
            cfg,
            device,
            biencoder_checkpoint = os.getenv("BIENCODER_CKPT"),
            reranker_checkpoint  = os.getenv("RERANKER_CKPT"),
            parser_checkpoint    = os.getenv("PARSER_CKPT"),
            index_path           = os.getenv("INDEX_PATH", "models/faiss_index"),
        )
        logger.info("Pipeline loaded.")
    except Exception as e:
        logger.error(f"Pipeline load failed: {e}")
        pipeline = None

    yield
    logger.info("Shutting down.")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title       = "Product Matching API",
    description = (
        "Multistage multimodal product matching cho Vietnamese secondhand marketplace.\n\n"
        "**Stage 0** — Query Understanding: rule-based extractors + KeyBERT\n"
        "**Stage 1** — Category Router: sub-index routing theo category prediction\n"
        "**Stage 2** — BiEncoder Retrieval: FAISS ANN search\n"
        "**Stage 3** — Intent-Aware Reranker: hard constraint penalty + soft preference adj\n"
    ),
    version     = "2.0.0",
    lifespan    = lifespan,
)


# ── Request schemas ───────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    query: str = Field(
        ..., min_length=1, max_length=512,
        example="Cần áo khoác nữ màu đen size L dưới 300k còn mới",
    )


class KeywordRequest(BaseModel):
    text:  str = Field(..., min_length=1, max_length=512,
                       example="Tôi muốn mua áo khoác đen size L giá dưới 300k")
    top_n: int = Field(default=6, ge=1, le=20, description="Số keywords muốn trích xuất")


class RetrieveRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=512,
                       example="laptop cũ còn tốt budget 5 triệu")
    top_k: int = Field(default=20, ge=1, le=100, description="Số candidates trả về")


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=512,
                       example="áo bomber đen oversize Nike gấp")
    top_k: int = Field(default=10, ge=1, le=50, description="Số kết quả cuối trả về")


class IndexRebuildRequest(BaseModel):
    catalog_path: str = Field(default="data/processed/catalog.jsonl")


# ── Helper ────────────────────────────────────────────────────────────────────

def _require_parser():
    if query_parser is None:
        raise HTTPException(503, "QueryParser not loaded")

def _require_pipeline():
    if pipeline is None:
        raise HTTPException(503, "Pipeline not loaded — build the index first")


# ══════════════════════════════════════════════════════════════════════════════
# STAGE 0 — Query Understanding
# Model: paraphrase-multilingual-MiniLM-L12-v2 (KeyBERT) + rule-based extractors
# ══════════════════════════════════════════════════════════════════════════════

@app.post(
    "/stage0/parse",
    tags=["Stage 0 — Query Understanding"],
    summary="Full query understanding (hard constraints + soft preferences + keywords)",
)
def stage0_parse(req: QueryRequest):
    """
    Chạy toàn bộ Stage 0:

    **Rule-based extractors** (không cần model):
    - `hard.price` — "dưới 300k" → `{raw, normalized: 300000.0}` *(hard constraint)*
    - `hard.condition_floor` — "còn mới" → `{raw, normalized: "like_new"}` *(hard)*
    - `soft.color` — "đen" → `{raw, normalized: "black"}` *(soft preference)*
    - `soft.size`, `soft.gender`, `soft.brand`, `soft.style`

    **KeyBERT** (`paraphrase-multilingual-MiniLM-L12-v2`):
    - `keywords` — top-N semantic keywords với cosine scores
    - `enriched_query` — dùng làm input cho FAISS retrieval

    **Category classifier** (MLP 384→128→6, nếu có checkpoint):
    - `routing.candidates` — top-K categories + confidence
    """
    _require_parser()
    t0     = time.perf_counter()
    parsed = query_parser.parse(req.query)
    return {**parsed.to_dict(), "latency_ms": round((time.perf_counter() - t0) * 1000, 2)}


@app.post(
    "/stage0/keywords",
    tags=["Stage 0 — Query Understanding"],
    summary="KeyBERT keyword extraction only (no rule-based, faster)",
)
def stage0_keywords(req: KeywordRequest):
    """
    Chỉ chạy **KeyBERT** — bỏ qua price/color/size/condition extractors.

    Dùng cho: search-as-you-type, debug keyword model, autocomplete suggestions.
    Nhanh hơn `/stage0/parse` ~40ms.

    Model: `paraphrase-multilingual-MiniLM-L12-v2` + KeyBERT (MMR diversity=0.5)
    """
    t0         = time.perf_counter()
    normalized = normalize_query(req.text)
    keywords, scores = extract_keywords(normalized, top_n=req.top_n)
    latency    = (time.perf_counter() - t0) * 1000
    enriched   = normalized + " " + " ".join(keywords[:4]) if keywords else normalized
    return {
        "query":          req.text,
        "normalized":     normalized,
        "keywords":       keywords,
        "keyword_scores": scores,
        "enriched_query": enriched,
        "top_n":          req.top_n,
        "latency_ms":     round(latency, 2),
    }


# ══════════════════════════════════════════════════════════════════════════════
# STAGE 1 — Category Router
# Model: sub-index routing dùng output từ Stage 0 CategoryClassifier
# ══════════════════════════════════════════════════════════════════════════════

@app.post(
    "/stage1/route",
    tags=["Stage 1 — Category Router"],
    summary="Xem routing decision: sub-index nào sẽ được dùng cho query này",
)
def stage1_route(req: QueryRequest):
    """
    Chạy Stage 0 + Stage 1 routing decision.

    Stage 1 không có model riêng — dùng category prediction từ Stage 0.

    **Logic routing**:
    - confidence ≥ 0.35 → search trong sub-index của category đó (thu hẹp không gian)
    - confidence < 0.35 → fallback toàn bộ index (an toàn hơn)

    Response cho biết:
    - `index_used`: sub-index nào / full index
    - `index_size`: số sản phẩm trong index đó
    - `routing.candidates`: top categories + confidence
    """
    _require_pipeline()
    t0     = time.perf_counter()
    result = pipeline.route_only(req.query)
    return {**result, "latency_ms": round((time.perf_counter() - t0) * 1000, 2)}


# ══════════════════════════════════════════════════════════════════════════════
# STAGE 2 — BiEncoder Retrieval
# Model: paraphrase-multilingual-MiniLM-L12-v2 (fine-tuned bi-encoder) + FAISS
# ══════════════════════════════════════════════════════════════════════════════

@app.post(
    "/stage2/retrieve",
    tags=["Stage 2 — Dense Retrieval"],
    summary="Retrieval candidates trước khi rerank (stages 0+1+2)",
)
def stage2_retrieve(req: RetrieveRequest):
    """
    Chạy Stage 0 → Stage 1 → Stage 2, trả về retrieval candidates **trước khi rerank**.

    Dùng để:
    - Debug recall: xem sản phẩm đúng có trong top-K candidates không
    - So sánh retrieval score vs rerank score
    - Đánh giá chất lượng embedding model

    Model:
    - Text encoder: `paraphrase-multilingual-MiniLM-L12-v2` (384-dim)
    - Image encoder: `openai/clip-vit-base-patch32` (fusion, optional)
    - Index: FAISS IndexFlatIP (inner product = cosine similarity sau normalize)
    """
    _require_pipeline()
    t0     = time.perf_counter()
    result = pipeline.retrieve_only(req.query, top_k=req.top_k)
    result["latency_ms"] = round((time.perf_counter() - t0) * 1000, 2)
    return result


# ══════════════════════════════════════════════════════════════════════════════
# FULL PIPELINE — Stages 0 → 1 → 2 → 3
# Stage 3 model: rule-based score adjustments + optional MultimodalReranker MLP
# ══════════════════════════════════════════════════════════════════════════════

@app.post(
    "/search",
    tags=["Full Pipeline — Stages 0→1→2→3"],
    summary="Full pipeline: query understanding → retrieval → reranking",
)
def search(req: SearchRequest):
    """
    Chạy toàn bộ pipeline:

    - **Stage 0**: parse query → ParsedQuery (hard constraints + soft prefs + keywords)
    - **Stage 1**: category routing → chọn sub-index hoặc full index
    - **Stage 2**: encode query → FAISS ANN search → top-K candidates
    - **Stage 3**: rerank theo hard constraints + soft preferences:
        - `hard.price` violation → score × 0.25 (sản phẩm vượt budget xuống cuối)
        - `hard.condition_floor` violation → score × 0.4–0.8
        - `soft.condition_preferred` match → ±small adj
        - diversity penalty → tránh top-10 cùng 1 sản phẩm

    Response bao gồm:
    - `results[].intent_signals`: lý do điều chỉnh score cho từng sản phẩm
    - `parsed_query`: cấu trúc đã parse để debug
    - `timings`: latency breakdown per stage (ms)
    """
    _require_pipeline()
    try:
        output = pipeline.search(req.query)
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(500, str(e))

    return {
        "query":        req.query,
        "results":      output["results"][:req.top_k],
        "total_hits":   len(output["results"][:req.top_k]),
        "parsed_query": output["parsed_query"],
        "timings":      output["timings"],
    }


# ══════════════════════════════════════════════════════════════════════════════
# SYSTEM
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/health", tags=["System"])
def health():
    return {
        "status":          "ok",
        "stage0_ready":    query_parser is not None,
        "pipeline_ready":  pipeline is not None,
        "classifier_loaded": (
            pipeline is not None and pipeline.query_parser.classifier is not None
        ),
        "reranker_loaded": (
            pipeline is not None and pipeline.reranker.reranker is not None
        ),
    }


@app.get("/stats", tags=["System"])
def stats():
    _require_pipeline()
    idx = pipeline.product_index
    sub = pipeline.cat_router.sub_indexes
    return {
        "full_index":     {"size": len(idx), "dim": idx.dim, "type": idx.index_type},
        "sub_indexes":    {cat: len(sub_idx) for cat, sub_idx in sub.items()},
        "top_k_retrieve": pipeline.top_k_retrieve,
        "top_k_final":    pipeline.top_k_final,
        "reranker":       pipeline.reranker.reranker is not None,
        "classifier":     pipeline.query_parser.classifier is not None,
    }


@app.post("/index/rebuild", tags=["System"])
def rebuild_index(req: IndexRebuildRequest):
    """Rebuild FAISS index từ catalog mới. Gọi sau khi thêm sản phẩm."""
    _require_pipeline()
    from scripts.build_index import build_index
    cfg = load_config(os.getenv("CONFIG_PATH", "configs/config.yaml"))
    try:
        build_index(cfg, req.catalog_path, "models/faiss_index", get_device())
        from src.retrieval import ProductIndex
        pipeline.cat_router.full_index = ProductIndex.load("models/faiss_index")
        return {"status": "ok", "index_size": len(pipeline.product_index)}
    except Exception as e:
        raise HTTPException(500, str(e))


if __name__ == "__main__":
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=False)
