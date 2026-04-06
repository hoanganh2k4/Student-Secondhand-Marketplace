"""
src/catalog/canonicalizer.py
Product Canonicalization — trích xuất structured attributes từ seller text.

Chạy offline khi build index: parse title + description của từng sản phẩm
để lấy color / size / gender / brand / condition / product_type.

Kết quả được lưu vào metadata["attributes"] trong FAISS index và BM25 index.
Stage 3 dùng attributes này để tính attribute match score chính xác.

Tại sao cần thiết:
  - Catalog gốc chỉ có title + description dạng raw text
  - Nếu không canonicalize, Stage 3 compare query.soft.color với None → luôn miss
  - Với canonicalization: query "màu đen" → soft.color="black" → product.color="black" → match!
"""
from __future__ import annotations

from typing import Any

# Re-use extractors từ stage0 (không duplicate logic)
from src.pipeline.stage0 import (
    extract_color,
    extract_size,
    extract_gender,
    extract_brand,
    extract_condition,
    extract_product_type,
    normalize_query,
)
from src.utils import get_logger

logger = get_logger(__name__)


class ProductCanonicalizer:
    """
    Parse structured attributes từ product text (title + description).

    Usage:
        canonicalizer = ProductCanonicalizer()
        attributes = canonicalizer.canonicalize(title, description)
        # → {"color": "black", "size": "L", "gender": "female", ...}
    """

    def canonicalize(
        self,
        title:       str,
        description: str = "",
        existing:    dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Trích xuất attributes từ seller text.

        Args:
            title:       Product title.
            description: Product description (optional).
            existing:    Existing metadata dict — attributes already present
                         (e.g., condition, category) are preserved.

        Returns:
            Dict of canonicalized attributes:
            {
                "color":        str | None,   # "black"
                "size":         str | None,   # "L"
                "gender":       str | None,   # "female"
                "brand":        str | None,   # "nike"
                "condition":    str | None,   # "like_new"  (từ seller text nếu missing)
                "product_type": str | None,   # "outerwear"
            }
        """
        existing = existing or {}

        # Gộp title + description để tìm kiếm attribute (title ưu tiên hơn)
        combined = normalize_query(f"{title} {description}")

        color        = extract_color(combined)
        size         = extract_size(combined)
        gender       = extract_gender(combined)
        brand        = extract_brand(combined)
        product_type = extract_product_type(combined)

        # Condition: ưu tiên field có sẵn trong catalog
        condition_str = existing.get("condition")
        if condition_str is None:
            hard_cond, soft_cond = extract_condition(combined)
            span = hard_cond or soft_cond
            condition_str = span.normalized if span else None

        return {
            "color":        color.normalized        if color        else None,
            "size":         size.normalized         if size         else None,
            "gender":       gender.normalized       if gender       else None,
            "brand":        brand.normalized        if brand        else None,
            "product_type": product_type.normalized if product_type else None,
            "condition":    condition_str,
        }

    def enrich_metadata(self, meta: dict[str, Any]) -> dict[str, Any]:
        """
        Enrich existing product metadata dict with parsed attributes.

        Preserves all existing fields; adds/overwrites "attributes" key only.
        """
        title       = meta.get("title", "")
        description = meta.get("description", "")
        attributes  = self.canonicalize(title, description, existing=meta)
        return {**meta, "attributes": attributes}

    def enrich_catalog(
        self,
        catalog: dict[str, dict[str, Any]] | list[dict[str, Any]],
    ) -> dict[str, dict[str, Any]] | list[dict[str, Any]]:
        """
        Enrich all products in catalog. Accepts both dict and list format.

        - dict format (from load_catalog): {product_id → meta} → returns same dict
        - list format: [meta, ...] → returns same list
        """
        if isinstance(catalog, dict):
            enriched = {}
            items = list(catalog.items())
            for i, (pid, product) in enumerate(items):
                enriched[pid] = self.enrich_metadata(product)
                if (i + 1) % 100 == 0:
                    logger.info(f"Canonicalized {i + 1}/{len(items)} products")
            logger.info(f"Canonicalization complete: {len(enriched)} products")
            return enriched
        else:
            enriched = []
            for i, product in enumerate(catalog):
                enriched.append(self.enrich_metadata(product))
                if (i + 1) % 100 == 0:
                    logger.info(f"Canonicalized {i + 1}/{len(catalog)} products")
            logger.info(f"Canonicalization complete: {len(enriched)} products")
            return enriched
