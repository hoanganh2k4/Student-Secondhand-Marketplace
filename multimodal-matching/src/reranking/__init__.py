"""
src/reranking/__init__.py
Stage 2: Multimodal re-ranker (precision-focused).

Takes Stage-1 candidates (query, product_text, product_image)
and outputs a scalar relevance score for each, enabling precise
re-ordering of the top-100 candidates → top-10.

Architecture:
    query_text  → TextEncoder → q_vec (text_dim)
    product_text → TextEncoder → p_vec (text_dim)
    product_image → ImageEncoder → img_vec (image_dim)
    [q_vec | p_vec | q_vec*p_vec | img_vec] → MLP → score
    
    The element-wise product q_vec*p_vec captures semantic interaction
    between query and product text (inspired by cross-attention shortcuts).
"""
from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F

from src.embedding import TextEncoder, ImageEncoder


class MultimodalReranker(nn.Module):
    """
    Re-ranking model.
    Input:  (query_text, product_text, product_image)
    Output: scalar relevance score ∈ [0, 1]
    """

    def __init__(
        self,
        text_encoder_name: str  = "sentence-transformers/all-MiniLM-L6-v2",
        image_encoder_name: str = "openai/clip-vit-base-patch32",
        hidden_dim: int = 256,
        dropout: float = 0.2,
        share_text_encoder: bool = False,
    ):
        """
        Args:
            share_text_encoder: If True, query and product use the same text
                                encoder (fewer params, slight quality drop).
        """
        super().__init__()

        self.query_encoder   = TextEncoder(text_encoder_name)
        self.product_encoder = self.query_encoder if share_text_encoder \
                               else TextEncoder(text_encoder_name)
        self.image_encoder   = ImageEncoder(image_encoder_name)

        t_dim = self.query_encoder.output_dim
        i_dim = self.image_encoder.output_dim

        # Feature vector: [q | p | q*p | img]
        # q*p: element-wise interaction term (explicit similarity signal)
        mlp_input_dim = t_dim + t_dim + t_dim + i_dim

        self.mlp = nn.Sequential(
            nn.Linear(mlp_input_dim, hidden_dim * 2),
            nn.LayerNorm(hidden_dim * 2),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim * 2, hidden_dim),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, 1),
        )

    def forward(
        self,
        query_input_ids:      torch.Tensor,   # (B, Lq)
        query_attention_mask: torch.Tensor,   # (B, Lq)
        prod_input_ids:       torch.Tensor,   # (B, Lp)
        prod_attention_mask:  torch.Tensor,   # (B, Lp)
        images:               torch.Tensor,   # (B, 3, H, W)
    ) -> torch.Tensor:
        """
        Returns:
            scores: (B,) relevance scores (raw logits, apply sigmoid for [0,1])
        """
        q_vec   = self.query_encoder(query_input_ids, query_attention_mask)    # (B, t_dim)
        p_vec   = self.product_encoder(prod_input_ids, prod_attention_mask)    # (B, t_dim)
        img_vec = self.image_encoder(images)                                   # (B, i_dim)

        # Interaction term
        interaction = q_vec * p_vec                                            # (B, t_dim)

        features = torch.cat([q_vec, p_vec, interaction, img_vec], dim=-1)    # (B, 4*dim)
        scores   = self.mlp(features).squeeze(-1)                             # (B,)
        return scores


# ── Simple Cross-Encoder (text-only fallback) ─────────────────────────────────

class CrossEncoderReranker(nn.Module):
    """
    Text-only cross encoder — faster, simpler, no image signal.
    Use when image availability is low or as a quick baseline.
    """

    def __init__(
        self,
        model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2",
    ):
        super().__init__()
        from transformers import AutoModelForSequenceClassification, AutoTokenizer
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model     = AutoModelForSequenceClassification.from_pretrained(model_name)

    def forward(
        self,
        queries: list[str],
        products: list[str],
        device: torch.device,
    ) -> torch.Tensor:
        encoded = self.tokenizer(
            queries, products,
            padding=True, truncation=True,
            max_length=256, return_tensors="pt",
        )
        encoded = {k: v.to(device) for k, v in encoded.items()}
        logits  = self.model(**encoded).logits.squeeze(-1)   # (B,)
        return logits


# ── Reranker Inference Helper ─────────────────────────────────────────────────

class RerankerInference:
    """
    Wraps a trained reranker model to provide batch inference
    over Stage-1 candidates.
    """

    def __init__(
        self,
        model: MultimodalReranker | CrossEncoderReranker,
        device: torch.device,
        batch_size: int = 16,
    ):
        self.model      = model.to(device).eval()
        self.device     = device
        self.batch_size = batch_size

    @torch.no_grad()
    def rerank(
        self,
        query: str,
        candidates: list[dict],
        top_k: int = 10,
        image_transform=None,
    ) -> list[dict]:
        """
        Re-rank Stage-1 candidates for a single query.

        Args:
            query:      Raw query string.
            candidates: List of dicts from ProductIndex.search().
            top_k:      Number of final results to return.
            image_transform: torchvision transform (required for multimodal model).

        Returns:
            top_k candidates sorted by rerank_score descending.
        """
        if not candidates:
            return []

        all_scores: list[float] = []

        for i in range(0, len(candidates), self.batch_size):
            batch = candidates[i : i + self.batch_size]
            scores = self._score_batch(query, batch, image_transform)
            all_scores.extend(scores)

        # Attach scores and sort
        for cand, score in zip(candidates, all_scores):
            cand["rerank_score"] = score

        return sorted(candidates, key=lambda x: x["rerank_score"], reverse=True)[:top_k]

    def _score_batch(
        self,
        query: str,
        batch: list[dict],
        image_transform,
    ) -> list[float]:
        from src.data import load_image
        import torch

        if isinstance(self.model, CrossEncoderReranker):
            queries  = [query] * len(batch)
            products = [c["metadata"].get("title", "") for c in batch]
            logits   = self.model(queries, products, self.device)
            return logits.sigmoid().cpu().tolist()

        # Multimodal path
        tokenizer = self.model.query_encoder.st_model.tokenizer

        queries  = [query] * len(batch)
        products = [c["metadata"].get("title", "") + " " + c["metadata"].get("description", "")
                    for c in batch]

        q_enc = tokenizer(queries,  padding=True, truncation=True, max_length=64,  return_tensors="pt")
        p_enc = tokenizer(products, padding=True, truncation=True, max_length=128, return_tensors="pt")

        if image_transform:
            images = torch.stack([
                load_image(c["metadata"].get("image_path"), image_transform)
                for c in batch
            ])
        else:
            images = torch.zeros(len(batch), 3, 224, 224)

        logits = self.model(
            q_enc["input_ids"].to(self.device),
            q_enc["attention_mask"].to(self.device),
            p_enc["input_ids"].to(self.device),
            p_enc["attention_mask"].to(self.device),
            images.to(self.device),
        )
        return logits.sigmoid().cpu().tolist()
