"""
src/pipeline/__init__.py
MultiStagePipeline — orchestrates all 4 stages.

  Stage 0: QueryParser       → ParsedQuery (structured intent)
  Stage 1: CategoryRouter    → pre-filtered candidates
  Stage 2: BiEncoder + FAISS → top-K by embedding similarity
  Stage 3: IntentAwareReranker → final ranked list

Thay thế src/inference/MatchingPipeline.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, asdict  # asdict used by MultiStageResult.to_dict
from pathlib import Path
from typing import Any

import torch

from src.embedding import BiEncoder
from src.data import get_image_transform
from src.pipeline.stage0 import QueryParser
from src.pipeline.stage1 import CategoryRouter
from src.pipeline.stage3 import IntentAwareReranker
from src.reranking import RerankerInference
from src.retrieval import ProductIndex, BM25Retriever, reciprocal_rank_fusion
from src.schemas.query import ParsedQuery
from src.utils import get_logger

logger = get_logger(__name__)


@dataclass
class MultiStageResult:
    product_id:      str
    title:           str
    description:     str
    price:           float | None
    condition:       str | None
    category:        str | None
    location:        str | None
    retrieval_score: float
    rerank_score:    float
    rank:            int
    intent_signals:  dict | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class MultiStagePipeline:
    """
    4-stage product matching pipeline.

    from_config() — load từ config.yaml + checkpoints.
    search(query) — trả về ranked list of products.
    """

    def __init__(
        self,
        bi_encoder:    BiEncoder,
        query_parser:  QueryParser,
        cat_router:    CategoryRouter,
        reranker:      IntentAwareReranker,
        device:        torch.device,
        bm25:          BM25Retriever | None = None,
        top_k_retrieve: int = 100,
        top_k_final:    int = 10,
    ):
        self.bi_encoder     = bi_encoder.to(device).eval()
        self.query_parser   = query_parser
        self.cat_router     = cat_router
        self.reranker       = reranker
        self.device         = device
        self.bm25           = bm25
        self.top_k_retrieve = top_k_retrieve
        self.top_k_final    = top_k_final
        self.image_transform = get_image_transform()

    @classmethod
    def from_config(
        cls,
        cfg,
        device: torch.device,
        biencoder_checkpoint:  str | None = None,
        reranker_checkpoint:   str | None = None,
        parser_checkpoint:     str | None = None,
        index_path:            str = "models/faiss_index",
    ) -> "MultiStagePipeline":
        from src.reranking import MultimodalReranker

        # ── BiEncoder (Stage 2) ──────────────────────────────────────────────
        bi_encoder = BiEncoder(
            text_encoder_name  = cfg.model.text_encoder,
            image_encoder_name = cfg.model.image_encoder,
            fusion_dim         = cfg.model.fusion_dim,
            fusion_strategy    = cfg.model.fusion_strategy,
        )
        if biencoder_checkpoint:
            ckpt = torch.load(biencoder_checkpoint, map_location="cpu")
            bi_encoder.load_state_dict(ckpt.get("model_state", ckpt))
            logger.info(f"Loaded BiEncoder from {biencoder_checkpoint}")

        # Embed function for QueryParser (reuses text encoder)
        bi_encoder_eval = bi_encoder.to(device).eval()

        @torch.no_grad()
        def embed_fn(texts: list[str]) -> torch.Tensor:
            tokenized = bi_encoder_eval.text_encoder.tokenize(texts)
            ids  = tokenized["input_ids"].to(device)
            mask = tokenized["attention_mask"].to(device)
            return bi_encoder_eval.text_encoder(ids, mask)

        # ── Stage 0: QueryParser ─────────────────────────────────────────────
        # Auto-detect classifier checkpoint if not explicitly provided
        _default_clf = Path("checkpoints/stage0/category_clf.pt")
        _clf_path    = parser_checkpoint or (str(_default_clf) if _default_clf.exists() else None)

        if _clf_path:
            query_parser = QueryParser.load(_clf_path, embed_fn, device)
        else:
            # No trained classifier yet — still does rule-based extraction
            query_parser = QueryParser(embed_fn, classifier=None, device=device)
            logger.info("QueryParser running rule-based only (no category classifier)")

        # ── Stage 1: CategoryRouter ──────────────────────────────────────────
        product_index = ProductIndex.load(index_path)
        logger.info(f"Loaded index: {product_index}")

        sub_indexes = CategoryRouter.build_sub_indexes(product_index)
        cat_router  = CategoryRouter(product_index, sub_indexes)

        # ── Stage 3: IntentAwareReranker ─────────────────────────────────────
        neural_reranker = None
        if reranker_checkpoint:
            rr_model = MultimodalReranker(
                text_encoder_name  = cfg.model.text_encoder,
                image_encoder_name = cfg.model.image_encoder,
                hidden_dim         = cfg.reranking.hidden_dim,
            )
            rr_model.load_state_dict(torch.load(reranker_checkpoint, map_location="cpu"))
            neural_reranker = RerankerInference(rr_model, device, cfg.reranking.batch_size)
            logger.info(f"Loaded Reranker from {reranker_checkpoint}")

        intent_reranker = IntentAwareReranker(neural_reranker)

        # ── BM25 (lexical, optional) ─────────────────────────────────────────
        bm25 = BM25Retriever.load(index_path)
        if bm25:
            logger.info(f"BM25 index loaded: {len(bm25)} documents")
        else:
            logger.info("BM25 index not found — dense-only retrieval")

        return cls(
            bi_encoder     = bi_encoder,
            query_parser   = query_parser,
            cat_router     = cat_router,
            reranker       = intent_reranker,
            device         = device,
            bm25           = bm25 if bm25 else None,
            top_k_retrieve = cfg.retrieval.top_k_candidates,
            top_k_final    = cfg.reranking.top_k_final,
        )

    # ── Core search ──────────────────────────────────────────────────────────

    @torch.no_grad()
    def search(self, query: str) -> dict[str, Any]:
        timings: dict[str, float] = {}
        t0 = time.perf_counter()

        # Stage 0 — Parse intent
        parsed = self.query_parser.parse(query)
        timings["stage0_ms"] = round((time.perf_counter() - t0) * 1000, 1)
        logger.debug(
            f"[S0] cat={parsed.top_category} "
            f"price_max={parsed.price_max} "
            f"hard_cond={parsed.hard.condition_floor} "
            f"soft_cond={parsed.soft.condition_preferred} "
            f"({timings['stage0_ms']}ms)"
        )

        # Stage 1+2 — Category-routed dense + BM25 hybrid retrieval
        t1 = time.perf_counter()
        query_emb    = self.bi_encoder.encode_query([parsed.enriched_query], self.device)
        dense_hits   = self.cat_router.search(query_emb, parsed, top_k=self.top_k_retrieve)

        if self.bm25:
            bm25_hits  = self.bm25.search(parsed.enriched_query, top_k=self.top_k_retrieve)
            candidates = reciprocal_rank_fusion(dense_hits, bm25_hits)
            # Keep top_k_retrieve after RRF merge
            candidates = candidates[:self.top_k_retrieve]
            logger.debug(
                f"[S1+2] dense={len(dense_hits)} bm25={len(bm25_hits)} "
                f"merged={len(candidates)}"
            )
        else:
            candidates = dense_hits

        timings["stage1_2_ms"] = round((time.perf_counter() - t1) * 1000, 1)
        logger.debug(f"[S1+2] {len(candidates)} candidates ({timings['stage1_2_ms']}ms)")

        # Stage 3 — Intent-aware reranking
        t3 = time.perf_counter()
        ranked = self.reranker.rerank(
            query           = parsed.enriched_query,
            candidates      = candidates,
            parsed          = parsed,
            top_k           = self.top_k_final,
            image_transform = self.image_transform,
        )
        timings["stage3_ms"] = round((time.perf_counter() - t3) * 1000, 1)
        timings["total_ms"]  = round((time.perf_counter() - t0) * 1000, 1)
        logger.debug(f"[S3] → {len(ranked)} results ({timings['stage3_ms']}ms) | total {timings['total_ms']}ms")

        return {
            "results":      self._format_results(ranked),
            "parsed_query": parsed.to_dict(),
            "timings":      timings,
        }

    def _format_results(self, ranked: list[dict]) -> list[dict[str, Any]]:
        results = []
        for rank, c in enumerate(ranked, start=1):
            meta = c.get("metadata", {})
            r = MultiStageResult(
                product_id      = c["product_id"],
                title           = meta.get("title", ""),
                description     = meta.get("description", ""),
                price           = meta.get("price"),
                condition       = meta.get("condition"),
                category        = meta.get("category"),
                location        = meta.get("location"),
                retrieval_score = round(c.get("retrieval_score", 0.0), 4),
                rerank_score    = round(c.get("rerank_score", 0.0), 4),
                rank            = rank,
                intent_signals  = c.get("intent_signals"),
            )
            d = r.to_dict()
            d["subcategory"]     = meta.get("subcategory", "")
            d["why_this_result"] = c.get("why_this_result", [])
            results.append(d)
        return results

    # ── Per-stage debug methods ───────────────────────────────────────────────

    @torch.no_grad()
    def route_only(self, query: str) -> dict[str, Any]:
        """Stage 0 + Stage 1 routing decision — no retrieval."""
        parsed  = self.query_parser.parse(query)
        top_cat = parsed.top_category
        conf    = parsed.routing.top_confidence

        threshold = self.cat_router.CONFIDENCE_THRESHOLD
        if top_cat and conf >= threshold:
            sub = self.cat_router.sub_indexes.get(top_cat)
            if sub:
                index_used  = f"sub-index '{top_cat}'"
                index_size  = len(sub)
            else:
                index_used  = f"full index (filter by '{top_cat}')"
                index_size  = len(self.cat_router.full_index)
        else:
            index_used = "full index (confidence too low)"
            index_size = len(self.cat_router.full_index)

        return {
            "routing":      parsed.routing.candidates,
            "confident":    conf >= threshold,
            "index_used":   index_used,
            "index_size":   index_size,
            "threshold":    threshold,
            "parsed_query": parsed.to_dict(),
        }

    @torch.no_grad()
    def retrieve_only(self, query: str, top_k: int = 20) -> dict[str, Any]:
        """Stage 0 + Stage 1 + Stage 2 — retrieval without reranking."""
        t0 = time.perf_counter()

        parsed      = self.query_parser.parse(query)
        query_emb   = self.bi_encoder.encode_query([parsed.enriched_query], self.device)
        dense_hits  = self.cat_router.search(query_emb, parsed, top_k=top_k)

        if self.bm25:
            bm25_hits = self.bm25.search(parsed.enriched_query, top_k=top_k)
            raw       = reciprocal_rank_fusion(dense_hits, bm25_hits)[:top_k]
        else:
            raw       = dense_hits

        latency = round((time.perf_counter() - t0) * 1000, 1)

        candidates = [
            {
                "rank":            i + 1,
                "product_id":      c["product_id"],
                "title":           c.get("metadata", {}).get("title", ""),
                "price":           c.get("metadata", {}).get("price"),
                "condition":       c.get("metadata", {}).get("condition"),
                "category":        c.get("metadata", {}).get("category"),
                "retrieval_score": round(c.get("retrieval_score", 0.0), 4),
            }
            for i, c in enumerate(raw[:top_k])
        ]

        return {
            "query":        query,
            "candidates":   candidates,
            "total":        len(candidates),
            "parsed_query": parsed.to_dict(),
            "latency_ms":   latency,
        }

    # ── Expose index stats ────────────────────────────────────────────────────

    @property
    def product_index(self) -> ProductIndex:
        return self.cat_router.full_index
