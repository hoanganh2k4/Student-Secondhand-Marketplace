"""
src/pipeline/stage1/__init__.py
Stage 1 — Category Router

Chuyên môn duy nhất: thu hẹp không gian tìm kiếm dựa trên category prediction
từ Stage 0, trước khi FAISS retrieval chạy.

Chiến lược:
  - Nếu Stage 0 predict category với confidence ≥ threshold:
      → chỉ search trong products thuộc category đó (sub-index)
  - Nếu confidence thấp hoặc không có prediction:
      → fallback toàn bộ index (không lọc)

Lợi ích:
  - Giảm số lượng candidates FAISS trả về phải score ở Stage 2
  - Loại bỏ sách khi tìm điện thoại, áo khi tìm laptop,...
  - Không cần train thêm — dùng kết quả từ Stage 0
"""
from __future__ import annotations

from typing import Any

import numpy as np
import torch

from src.retrieval import ProductIndex
from src.schemas.query import ParsedQuery
from src.utils import get_logger

logger = get_logger(__name__)


class CategoryRouter:
    """
    Wraps ProductIndex, thêm category-aware filtering.

    Cách dùng:
        router = CategoryRouter(product_index, sub_indexes)
        candidates = router.search(query_emb, parsed_query, top_k=100)
    """

    CONFIDENCE_THRESHOLD = 0.35   # dưới ngưỡng này → fallback toàn index

    def __init__(
        self,
        full_index:  ProductIndex,
        sub_indexes: dict[str, ProductIndex] | None = None,
    ):
        """
        Args:
            full_index:  FAISS index chứa toàn bộ sản phẩm.
            sub_indexes: Dict category → ProductIndex chỉ chứa sản phẩm category đó.
                         Nếu None, CategoryRouter tự filter kết quả từ full_index.
        """
        self.full_index  = full_index
        self.sub_indexes = sub_indexes or {}

    # ── Main search ──────────────────────────────────────────────────────────

    def search(
        self,
        query_embedding: np.ndarray | torch.Tensor,
        parsed: ParsedQuery,
        top_k: int = 100,
    ) -> list[dict[str, Any]]:
        """
        Search with category-aware filtering + post-retrieval price noise reduction.

        Returns list of candidate dicts (same format as ProductIndex.search).
        """
        category_hints = parsed.category_hints
        top_conf       = parsed.top_categories[0][1] if parsed.top_categories else 0.0

        # ── Route: sub-index available ───────────────────────────────────────
        if category_hints and top_conf >= self.CONFIDENCE_THRESHOLD:
            top_cat = category_hints[0]

            if top_cat in self.sub_indexes:
                logger.debug(f"Routing to sub-index '{top_cat}' (conf={top_conf:.2f})")
                sub = self.sub_indexes[top_cat]
                candidates = sub.search(query_embedding, top_k=top_k)
                if candidates:
                    return self._apply_pre_filters(candidates, parsed, top_k)
                # sub-index empty → fallback
                logger.debug("Sub-index empty, falling back to full index")

            else:
                # No sub-index: filter full_index results by category metadata
                logger.debug(f"Filtering full index by category '{top_cat}' (conf={top_conf:.2f})")
                candidates = self._filtered_search(
                    query_embedding, top_k, category_hints, top_conf
                )
                if candidates:
                    return self._apply_pre_filters(candidates, parsed, top_k)

        # ── Fallback: full index ─────────────────────────────────────────────
        logger.debug("Using full index (no category filter)")
        candidates = self.full_index.search(query_embedding, top_k=top_k)
        return self._apply_pre_filters(candidates, parsed, top_k)

    # ── Pre-retrieval noise reduction ────────────────────────────────────────

    def _apply_pre_filters(
        self,
        candidates: list[dict[str, Any]],
        parsed:     ParsedQuery,
        top_k:      int,
    ) -> list[dict[str, Any]]:
        """
        Light post-FAISS filtering to reduce noise in candidate set.

        Removes candidates that are clearly out of price range (>2× budget)
        BEFORE Stage 3 reranking. This is intentionally generous (2× tolerance)
        to avoid dropping edge cases — Stage 3 handles the fine-grained penalizing.

        Also applies product_type filtering if confidence is high enough.
        """
        filtered = list(candidates)

        # Price: drop products clearly over budget (>2× max or <0.3× min)
        price_max = parsed.hard.price.max_value
        price_min = parsed.hard.price.min_value
        if price_max is not None or price_min is not None:
            kept = []
            dropped = 0
            for c in filtered:
                price = c.get("metadata", {}).get("price")
                if price is not None:
                    if price_max is not None and price > price_max * 2.0:
                        dropped += 1
                        continue
                    if price_min is not None and price < price_min * 0.3:
                        dropped += 1
                        continue
                kept.append(c)

            # Only apply filter if it doesn't shrink candidates below top_k // 2
            if len(kept) >= top_k // 2:
                filtered = kept
                if dropped:
                    logger.debug(f"Pre-filter: dropped {dropped} far-out-of-range products")

        return filtered[:top_k]

    def _filtered_search(
        self,
        query_embedding: np.ndarray | torch.Tensor,
        top_k: int,
        category_hints: list[str],
        top_conf: float,
    ) -> list[dict[str, Any]]:
        """
        Search full index, then filter by category.
        Fetches more candidates to compensate for filtering loss.
        """
        fetch_k = min(top_k * 5, len(self.full_index))
        raw     = self.full_index.search(query_embedding, top_k=fetch_k)

        # Allow top-2 categories if second has conf ≥ 0.20
        allowed = set(category_hints[:1])
        if len(category_hints) >= 2 and top_conf < 0.60:
            allowed.add(category_hints[1])

        filtered = [
            c for c in raw
            if c["metadata"].get("category") in allowed
        ]

        # If filtering removed too much, blend with unfiltered tail
        if len(filtered) < top_k // 2:
            unfiltered = [c for c in raw if c not in filtered]
            filtered  += unfiltered[:top_k - len(filtered)]

        return filtered[:top_k]

    # ── Build sub-indexes ────────────────────────────────────────────────────

    @staticmethod
    def build_sub_indexes(
        full_index: ProductIndex,
    ) -> dict[str, ProductIndex]:
        """
        Partition full_index into per-category sub-indexes.
        Call once after building the full FAISS index.
        """
        import faiss
        import numpy as np

        # Group indices by category
        cat_to_indices: dict[str, list[int]] = {}
        for i, pid in enumerate(full_index.id_map):
            cat = full_index.meta_map.get(pid, {}).get("category", "unknown")
            cat_to_indices.setdefault(cat, []).append(i)

        sub_indexes: dict[str, ProductIndex] = {}

        for cat, indices in cat_to_indices.items():
            if len(indices) < 3:
                continue   # too few products for a meaningful sub-index

            # Reconstruct embeddings for this category
            embs = np.zeros((len(indices), full_index.dim), dtype=np.float32)
            for j, idx in enumerate(indices):
                full_index._index.reconstruct(idx, embs[j])

            sub_idx = ProductIndex(dim=full_index.dim, index_type="flat")
            pids    = [full_index.id_map[i] for i in indices]
            metas   = [full_index.meta_map.get(pid, {}) for pid in pids]
            sub_idx.add(embs, pids, metas)

            sub_indexes[cat] = sub_idx
            logger.info(f"Sub-index '{cat}': {len(sub_idx)} products")

        return sub_indexes
