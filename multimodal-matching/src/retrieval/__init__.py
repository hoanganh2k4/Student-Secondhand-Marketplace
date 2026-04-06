"""
src/retrieval/__init__.py
Retrieval layer: FAISS dense + BM25 lexical, merged via RRF.
"""
from __future__ import annotations

from src.retrieval.bm25 import BM25Retriever
from src.retrieval.merger import reciprocal_rank_fusion

import json
import os
import pickle
from pathlib import Path
from typing import Any

import numpy as np
import torch

try:
    import faiss
    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False


class ProductIndex:
    """
    FAISS index with an ID→metadata mapping.

    Usage:
        index = ProductIndex(dim=256)
        index.add(embeddings, product_ids, metadata_list)
        results = index.search(query_emb, top_k=100)
        index.save("models/faiss_index")
        index = ProductIndex.load("models/faiss_index")
    """

    def __init__(self, dim: int, index_type: str = "flat", n_probe: int = 10):
        """
        Args:
            dim:        Embedding dimensionality (must match BiEncoder.embedding_dim).
            index_type: "flat" for exact search (small-mid scale, ≤1M products),
                        "ivf"  for approximate search (large scale, >1M products).
            n_probe:    Number of IVF cells to probe (only for IVF index).
        """
        if not FAISS_AVAILABLE:
            raise ImportError("faiss is not installed. Run: pip install faiss-cpu")

        self.dim        = dim
        self.index_type = index_type
        self.n_probe    = n_probe

        # id_map[i] = product_id for the i-th vector in the index
        self.id_map:   list[str]            = []
        self.meta_map: dict[str, dict[str, Any]] = {}  # product_id → metadata

        self._index: faiss.Index = self._build_index()

    # ── Index construction ──────────────────────────────────────────────────

    def _build_index(self) -> "faiss.Index":
        if self.index_type == "flat":
            # Exact inner-product search (embeddings are L2-normalised,
            # so inner product == cosine similarity)
            return faiss.IndexFlatIP(self.dim)

        elif self.index_type == "ivf":
            # IVF with flat quantiser — much faster for large corpora.
            # nlist = sqrt(N) is a common heuristic; we default 256 here.
            quantiser = faiss.IndexFlatIP(self.dim)
            index     = faiss.IndexIVFFlat(quantiser, self.dim, 256, faiss.METRIC_INNER_PRODUCT)
            index.nprobe = self.n_probe
            return index

        else:
            raise ValueError(f"Unknown index_type: {self.index_type}")

    # ── Add vectors ─────────────────────────────────────────────────────────

    def add(
        self,
        embeddings: np.ndarray | torch.Tensor,
        product_ids: list[str],
        metadata: list[dict[str, Any]] | None = None,
    ) -> None:
        """
        Add product embeddings to the index.

        Args:
            embeddings:  (N, dim) float32 array or tensor.
            product_ids: List of N product IDs.
            metadata:    Optional list of N metadata dicts.
        """
        if isinstance(embeddings, torch.Tensor):
            embeddings = embeddings.detach().cpu().numpy()

        embeddings = embeddings.astype(np.float32)
        assert embeddings.shape[1] == self.dim, (
            f"Embedding dim mismatch: got {embeddings.shape[1]}, expected {self.dim}"
        )

        # IVF index needs training before first add
        if self.index_type == "ivf" and not self._index.is_trained:
            self._index.train(embeddings)

        self._index.add(embeddings)
        self.id_map.extend(product_ids)

        if metadata:
            for pid, meta in zip(product_ids, metadata):
                self.meta_map[pid] = meta

    # ── Search ──────────────────────────────────────────────────────────────

    def search(
        self,
        query_embedding: np.ndarray | torch.Tensor,
        top_k: int = 100,
    ) -> list[dict[str, Any]]:
        """
        Retrieve top-K products for a query embedding.

        Args:
            query_embedding: (dim,) or (1, dim) float32.
            top_k:           Number of candidates to return.

        Returns:
            List of dicts: [{product_id, score, metadata}, ...]
            Sorted by score descending (highest = most similar).
        """
        if isinstance(query_embedding, torch.Tensor):
            query_embedding = query_embedding.detach().cpu().numpy()

        query_embedding = query_embedding.astype(np.float32)
        if query_embedding.ndim == 1:
            query_embedding = query_embedding[np.newaxis, :]   # (1, dim)

        actual_k = min(top_k, len(self.id_map))
        if actual_k == 0:
            return []

        scores, indices = self._index.search(query_embedding, actual_k)  # (1, K) each

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0 or idx >= len(self.id_map):
                continue
            pid = self.id_map[idx]
            results.append({
                "product_id": pid,
                "retrieval_score": float(score),
                "metadata": self.meta_map.get(pid, {}),
            })

        return results   # already sorted by FAISS (highest IP first)

    # ── Persistence ─────────────────────────────────────────────────────────

    def save(self, path: str | Path) -> None:
        """Save FAISS index + id/meta maps to disk."""
        path = Path(path)
        path.mkdir(parents=True, exist_ok=True)

        faiss.write_index(self._index, str(path / "index.faiss"))
        with open(path / "maps.pkl", "wb") as f:
            pickle.dump({"id_map": self.id_map, "meta_map": self.meta_map}, f)

        config = {"dim": self.dim, "index_type": self.index_type, "n_probe": self.n_probe}
        with open(path / "config.json", "w") as f:
            json.dump(config, f)

    @classmethod
    def load(cls, path: str | Path) -> "ProductIndex":
        """Load a previously saved index."""
        path = Path(path)
        with open(path / "config.json") as f:
            config = json.load(f)

        instance = cls.__new__(cls)
        instance.dim        = config["dim"]
        instance.index_type = config["index_type"]
        instance.n_probe    = config["n_probe"]
        instance._index     = faiss.read_index(str(path / "index.faiss"))

        with open(path / "maps.pkl", "rb") as f:
            maps = pickle.load(f)
        instance.id_map   = maps["id_map"]
        instance.meta_map = maps["meta_map"]

        return instance

    # ── Stats ────────────────────────────────────────────────────────────────

    def __len__(self) -> int:
        return len(self.id_map)

    def __repr__(self) -> str:
        return (
            f"ProductIndex(dim={self.dim}, type={self.index_type}, "
            f"size={len(self)})"
        )
