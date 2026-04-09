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


# ══════════════════════════════════════════════════════════════════════════════
# MATCHING — Pairwise semantic similarity (no FAISS, text-only)
# Model: reuses bi-encoder text encoder if pipeline loaded, else loads standalone
# ══════════════════════════════════════════════════════════════════════════════

_sentence_encoder = None


def _get_sentence_encoder():
    """Lazy-load a SentenceTransformer for cosine similarity scoring."""
    global _sentence_encoder
    if _sentence_encoder is not None:
        return _sentence_encoder
    # Reuse pipeline's text encoder if already loaded — avoids duplicate model in memory
    if pipeline is not None:
        _sentence_encoder = pipeline.bi_encoder.text_encoder.st_model
        logger.info("score-pairs: reusing pipeline text encoder")
        return _sentence_encoder
    from sentence_transformers import SentenceTransformer as ST
    model_name = os.getenv("TEXT_ENCODER", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
    logger.info(f"score-pairs: loading standalone encoder '{model_name}'")
    _sentence_encoder = ST(model_name)
    return _sentence_encoder


class ScorePairsRequest(BaseModel):
    query:      str              = Field(..., min_length=1, max_length=512,
                                         example="Cần laptop cũ dưới 5 triệu còn tốt")
    candidates: list[dict]       = Field(..., description="List of {id: str, text: str} objects")


@app.post(
    "/score-pairs",
    tags=["Matching — Pairwise Scoring"],
    summary="Compute semantic similarity between a query and N candidate texts",
)
def score_pairs(req: ScorePairsRequest):
    """
    Encodes `query` and each `candidates[i].text` using the bi-encoder text encoder,
    then returns cosine similarity scores (0–1) for every candidate.

    Used by the backend matching engine to score demand↔listing pairs without
    requiring a pre-built FAISS index.

    - Works even if the full pipeline (FAISS index) is not loaded.
    - Returns results sorted by score descending.
    """
    if not req.candidates:
        return {"results": [], "total": 0}

    encoder = _get_sentence_encoder()
    t0      = time.perf_counter()

    texts      = [req.query] + [c.get("text", "") for c in req.candidates]
    embeddings = encoder.encode(texts, normalize_embeddings=True, convert_to_tensor=True)

    import torch
    query_emb = embeddings[0]           # (dim,)
    cand_embs = embeddings[1:]          # (N, dim)
    scores    = (cand_embs @ query_emb).tolist()  # cosine sim (already L2-normalised)

    results = sorted(
        [{"id": c.get("id"), "score": round(float(s), 4)}
         for c, s in zip(req.candidates, scores)],
        key=lambda x: x["score"],
        reverse=True,
    )

    return {
        "query":      req.query,
        "results":    results,
        "total":      len(results),
        "latency_ms": round((time.perf_counter() - t0) * 1000, 2),
    }


# ══════════════════════════════════════════════════════════════════════════════
# VISION — CLIP ViT-L/14  +  Florence-2-base
# Loaded lazily on first request to keep startup fast when vision is not needed.
# ══════════════════════════════════════════════════════════════════════════════

from src.vision import CLIPImageFilter, FlorenceAttributeExtractor

_clip_filter:    CLIPImageFilter | None            = None
_florence:       FlorenceAttributeExtractor | None  = None
_VISION_ENABLED = os.getenv("VISION_ENABLED", "true").lower() == "true"


def _get_clip() -> CLIPImageFilter:
    global _clip_filter
    if _clip_filter is None:
        if not _VISION_ENABLED:
            raise HTTPException(503, "Vision features disabled (VISION_ENABLED=false)")
        _clip_filter = CLIPImageFilter(cache_dir=os.getenv("MODEL_CACHE_DIR"))
    return _clip_filter


def _get_florence() -> FlorenceAttributeExtractor:
    global _florence
    if _florence is None:
        if not _VISION_ENABLED:
            raise HTTPException(503, "Vision features disabled (VISION_ENABLED=false)")
        _florence = FlorenceAttributeExtractor(cache_dir=os.getenv("MODEL_CACHE_DIR"))
    return _florence


# ── Request / response schemas ────────────────────────────────────────────────

class ImageFilterRequest(BaseModel):
    image_urls: list[str] = Field(..., min_length=1, max_length=20, description="HTTP(S) URLs of product images")
    query:      str        = Field(..., min_length=1, max_length=256, description="Text query to compare against")
    threshold:  float      = Field(default=0.20, ge=0.0, le=1.0,   description="Minimum cosine similarity to include in filtered results")


class AttributeExtractRequest(BaseModel):
    image_url: str         = Field(..., description="URL of the product image")
    tasks:     list[str]   = Field(
        default=["caption", "ocr"],
        description="Florence-2 tasks: caption, detailed_caption, ocr, object_detection, dense_caption",
    )


class ListingContextRequest(BaseModel):
    image_urls: list[str]  = Field(..., min_length=1, max_length=10)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post(
    "/vision/filter",
    tags=["Vision — CLIP ViT-L/14"],
    summary="Score and filter product images against a text query",
)
def vision_filter(req: ImageFilterRequest):
    """
    Uses **CLIP ViT-L/14** (768-dim) to compute cosine similarity between
    each image and the text query, then returns images above `threshold`.

    Useful for:
    - Filtering proof-asset photos that don't match the listed item description
    - Ranking images for search result thumbnails
    - Detecting mismatched images (spam / wrong item)

    Returns list of {url, score} objects, sorted by score descending.
    """
    clip   = _get_clip()
    t0     = time.perf_counter()
    hits   = clip.filter_by_threshold(req.image_urls, req.query, req.threshold)
    hits.sort(key=lambda x: x[1], reverse=True)
    return {
        "query":      req.query,
        "threshold":  req.threshold,
        "results":    [{"url": url, "score": round(score, 4)} for url, score in hits],
        "latency_ms": round((time.perf_counter() - t0) * 1000, 2),
    }


@app.post(
    "/vision/score",
    tags=["Vision — CLIP ViT-L/14"],
    summary="Return raw CLIP similarity scores for all images (no threshold filter)",
)
def vision_score(req: ImageFilterRequest):
    """
    Returns a score for every image, including those below threshold.
    Useful for debugging or building a UI that shows confidence bars.
    """
    clip   = _get_clip()
    t0     = time.perf_counter()
    scores = clip.score_images(req.image_urls, req.query)
    return {
        "query":   req.query,
        "results": [
            {"url": url, "score": round(score, 4)}
            for url, score in zip(req.image_urls, scores)
        ],
        "latency_ms": round((time.perf_counter() - t0) * 1000, 2),
    }


@app.post(
    "/vision/extract",
    tags=["Vision — Florence-2-base"],
    summary="Extract structured attributes from a product image",
)
def vision_extract(req: AttributeExtractRequest):
    """
    Uses **Florence-2-base** (232M params, CPU-friendly) to extract:

    | Task | Output |
    |------|--------|
    | `caption` | Short product description |
    | `detailed_caption` | Long description with attributes |
    | `ocr` | Text visible in the image (brand, model, label) |
    | `object_detection` | Object labels (comma-separated) |
    | `dense_caption` | Region-level descriptions |

    The `ocr` + `detailed_caption` combo is particularly useful for indexing
    product images into the FAISS text retrieval index.
    """
    florence = _get_florence()
    t0       = time.perf_counter()
    attrs    = florence.extract(req.image_url, tasks=req.tasks)
    return {
        "image_url":  req.image_url,
        "attributes": attrs,
        "latency_ms": round((time.perf_counter() - t0) * 1000, 2),
    }


@app.post(
    "/vision/listing-context",
    tags=["Vision — Florence-2-base"],
    summary="Generate text context for FAISS indexing from listing images",
)
def vision_listing_context(req: ListingContextRequest):
    """
    Extracts `detailed_caption + OCR` for each image and concatenates them
    into a single string per image — ready to be appended to the listing's
    text corpus before FAISS re-indexing.

    Call this after a seller uploads proof assets, then pass the returned
    `contexts` to `/index/rebuild` as additional text fields.
    """
    florence = _get_florence()
    t0       = time.perf_counter()
    contexts = [florence.build_listing_context(url) for url in req.image_urls]
    return {
        "image_urls": req.image_urls,
        "contexts":   contexts,
        "combined":   " | ".join(c for c in contexts if c.strip()),
        "latency_ms": round((time.perf_counter() - t0) * 1000, 2),
    }


if __name__ == "__main__":
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=False)
