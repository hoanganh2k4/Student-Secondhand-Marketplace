"""
src/retrieval/merger.py
Reciprocal Rank Fusion (RRF) — kết hợp FAISS dense + BM25 lexical results.

Formula:
    score(d) = Σ_i  1 / (k + rank_i(d))

  k = 60 (chuẩn, giảm ảnh hưởng quá mức của rank-1)

Ưu điểm so với score interpolation:
  - Không cần calibrate: FAISS cosine score [0,1] và BM25 score [0,∞]
    có distribution khác nhau — RRF không cần biết điều đó
  - Robust: nếu một retriever miss một sản phẩm, retriever kia vẫn contribute
  - Không cần train thêm parameter nào
"""
from __future__ import annotations

from typing import Any


def reciprocal_rank_fusion(
    *ranked_lists: list[dict[str, Any]],
    k:      int = 60,
    id_key: str = "product_id",
) -> list[dict[str, Any]]:
    """
    Merge multiple ranked result lists using RRF.

    Args:
        *ranked_lists: Các danh sách kết quả từ các retriever khác nhau.
                       Mỗi list = [{product_id, retrieval_score, metadata}, ...]
                       Thứ tự trong list = rank (index 0 = rank 1).
        k:             RRF constant (default 60).
        id_key:        Key dùng làm product identifier.

    Returns:
        Merged list sorted by RRF score descending.
        retrieval_score = tổng RRF contribution từ tất cả lists.
    """
    rrf_scores: dict[str, float]      = {}
    meta_map:   dict[str, dict]       = {}
    sources:    dict[str, list[str]]  = {}   # pid → which lists contributed

    for list_idx, ranked in enumerate(ranked_lists):
        list_name = f"list_{list_idx}"
        for rank, item in enumerate(ranked, start=1):
            pid   = item[id_key]
            score = 1.0 / (k + rank)
            rrf_scores[pid] = rrf_scores.get(pid, 0.0) + score
            if pid not in meta_map:
                meta_map[pid] = item.get("metadata", {})
            sources.setdefault(pid, []).append(list_name)

    merged = [
        {
            "product_id":      pid,
            "retrieval_score": round(score, 6),
            "metadata":        meta_map[pid],
        }
        for pid, score in sorted(rrf_scores.items(), key=lambda x: -x[1])
    ]
    return merged
