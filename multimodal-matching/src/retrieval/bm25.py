"""
src/retrieval/bm25.py
BM25 lexical retrieval — bổ sung cho FAISS dense retrieval.

Tại sao cần BM25:
  - FAISS giỏi semantic similarity ("áo mùa đông" ↔ "jacket winter")
  - BM25 giỏi exact token match ("nike", "iphone 13", "size L", "thinkpad t14s")
  - Kết hợp qua RRF → tốt hơn cả hai đơn lẻ

Saved alongside FAISS index as bm25.pkl.
"""
from __future__ import annotations

import pickle
import re
import unicodedata
from pathlib import Path
from typing import Any

import numpy as np

try:
    from rank_bm25 import BM25Okapi
    BM25_AVAILABLE = True
except ImportError:
    BM25_AVAILABLE = False

from src.utils import get_logger

logger = get_logger(__name__)

_TOKEN_RE = re.compile(r"[^\w\s]", re.UNICODE)


def _tokenize(text: str) -> list[str]:
    """Lowercase, strip punctuation, split on whitespace. Min length 2."""
    text = unicodedata.normalize("NFC", text).lower()
    text = _TOKEN_RE.sub(" ", text)
    return [t for t in text.split() if len(t) > 1]


class BM25Retriever:
    """
    BM25 index over product text (title + description).

    Usage:
        retriever = BM25Retriever()
        retriever.build(product_ids, texts, metadata_list)
        results = retriever.search("áo khoác đen nike", top_k=100)
        retriever.save("models/faiss_index")
        retriever = BM25Retriever.load("models/faiss_index")
    """

    FILENAME = "bm25.pkl"

    def __init__(self):
        self._bm25:     BM25Okapi | None         = None
        self._id_map:   list[str]                = []
        self._meta_map: dict[str, dict[str, Any]] = {}

    def build(
        self,
        product_ids: list[str],
        texts:       list[str],
        metadata:    list[dict[str, Any]] | None = None,
    ) -> None:
        """
        Build BM25 index from product texts.

        Args:
            product_ids: List of product IDs.
            texts:       Corresponding text strings (title + description).
            metadata:    Optional metadata per product.
        """
        if not BM25_AVAILABLE:
            raise ImportError("rank_bm25 is not installed. Run: pip install rank-bm25")

        tokenized     = [_tokenize(t) for t in texts]
        self._bm25    = BM25Okapi(tokenized)
        self._id_map  = list(product_ids)
        self._meta_map = {}
        if metadata:
            for pid, meta in zip(product_ids, metadata):
                self._meta_map[pid] = meta

        logger.info(f"BM25 index built: {len(self._id_map)} documents")

    def search(
        self,
        query: str,
        top_k: int = 100,
    ) -> list[dict[str, Any]]:
        """
        BM25 retrieval — returns top-K candidates sorted by BM25 score.

        Returns same format as ProductIndex.search:
        [{product_id, retrieval_score, metadata}, ...]
        """
        if self._bm25 is None or not self._id_map:
            return []

        tokens = _tokenize(query)
        if not tokens:
            return []

        scores  = self._bm25.get_scores(tokens)
        top_k   = min(top_k, len(self._id_map))
        top_idx = np.argsort(scores)[::-1][:top_k]

        results = []
        for idx in top_idx:
            if scores[idx] <= 0.0:
                continue
            pid = self._id_map[idx]
            results.append({
                "product_id":      pid,
                "retrieval_score": float(scores[idx]),
                "metadata":        self._meta_map.get(pid, {}),
            })
        return results

    def save(self, path: str | Path) -> None:
        """Persist BM25 index alongside FAISS index."""
        path = Path(path)
        path.mkdir(parents=True, exist_ok=True)
        with open(path / self.FILENAME, "wb") as f:
            pickle.dump({
                "bm25":     self._bm25,
                "id_map":   self._id_map,
                "meta_map": self._meta_map,
            }, f)
        logger.info(f"BM25 index saved → {path / self.FILENAME}  ({len(self)} docs)")

    @classmethod
    def load(cls, path: str | Path) -> "BM25Retriever":
        """Load BM25 index from disk. Returns empty retriever if not found."""
        path     = Path(path)
        pkl_path = path / cls.FILENAME
        if not pkl_path.exists():
            logger.warning(f"BM25 index not found at {pkl_path} — BM25 disabled")
            return cls()

        with open(pkl_path, "rb") as f:
            data = pickle.load(f)

        instance           = cls()
        instance._bm25     = data["bm25"]
        instance._id_map   = data["id_map"]
        instance._meta_map = data["meta_map"]
        logger.info(f"BM25 index loaded: {len(instance._id_map)} documents")
        return instance

    def __len__(self) -> int:
        return len(self._id_map)

    def __bool__(self) -> bool:
        return self._bm25 is not None and len(self._id_map) > 0
