"""
src/embedding/__init__.py
Bi-encoder for multimodal product embedding.

Architecture:
    text  → SentenceTransformer → text_dim
    image → CLIP ViT           → image_dim
    [text_vec | image_vec]     → ProjectionFusion → fusion_dim  (L2-normalised)

The fused vector is used for both:
  - Building the FAISS index (products)
  - Encoding buyer queries (text only, image = zero tensor)
"""
from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F
from sentence_transformers import SentenceTransformer
from transformers import CLIPModel, CLIPProcessor


# ── Text Encoder ───────────────────────────────────────────────────────────────

class TextEncoder(nn.Module):
    """
    Wraps a SentenceTransformer so it integrates naturally with PyTorch training.
    Outputs L2-normalised embeddings of shape (B, text_dim).
    """

    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
        super().__init__()
        self.st_model = SentenceTransformer(model_name)
        # Expose the underlying transformer so we can fine-tune it
        self.transformer = self.st_model[0].auto_model
        self.pooling     = self.st_model[1]

    @property
    def output_dim(self) -> int:
        return self.st_model.get_sentence_embedding_dimension()

    def forward(self, input_ids: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
        """
        Args:
            input_ids:      (B, L)
            attention_mask: (B, L)
        Returns:
            embeddings: (B, text_dim) — L2-normalised
        """
        token_embs = self.transformer(
            input_ids=input_ids,
            attention_mask=attention_mask,
        ).last_hidden_state                                   # (B, L, H)

        # Mean pooling weighted by attention mask
        mask = attention_mask.unsqueeze(-1).float()           # (B, L, 1)
        summed = (token_embs * mask).sum(dim=1)               # (B, H)
        counts = mask.sum(dim=1).clamp(min=1e-9)              # (B, 1)
        pooled = summed / counts                              # (B, H)

        return F.normalize(pooled, p=2, dim=-1)

    def tokenize(self, texts: list[str], max_length: int = 128) -> dict[str, torch.Tensor]:
        """Tokenize a list of strings."""
        tokenizer = self.st_model.tokenizer
        encoded = tokenizer(
            texts,
            padding=True,
            truncation=True,
            max_length=max_length,
            return_tensors="pt",
        )
        return encoded


# ── Image Encoder ─────────────────────────────────────────────────────────────

class ImageEncoder(nn.Module):
    """
    Wraps CLIP's vision encoder.
    Outputs L2-normalised embeddings of shape (B, image_dim).
    """

    def __init__(self, model_name: str = "openai/clip-vit-base-patch32"):
        super().__init__()
        clip = CLIPModel.from_pretrained(model_name)
        self.vision_model   = clip.vision_model
        self.visual_proj    = clip.visual_projection
        self._output_dim    = clip.config.projection_dim

    @property
    def output_dim(self) -> int:
        return self._output_dim

    def forward(self, pixel_values: torch.Tensor) -> torch.Tensor:
        """
        Args:
            pixel_values: (B, 3, H, W) — pre-processed by CLIP processor
        Returns:
            embeddings: (B, image_dim) — L2-normalised
        """
        vision_out = self.vision_model(pixel_values=pixel_values)
        pooled     = vision_out.pooler_output             # (B, hidden)
        projected  = self.visual_proj(pooled)             # (B, image_dim)
        return F.normalize(projected, p=2, dim=-1)


# ── Fusion Strategies ─────────────────────────────────────────────────────────

class ConcatFusion(nn.Module):
    """Simple concatenation — output dim = text_dim + image_dim."""

    def __init__(self, text_dim: int, image_dim: int):
        super().__init__()
        self.output_dim = text_dim + image_dim

    def forward(self, text_vec: torch.Tensor, image_vec: torch.Tensor) -> torch.Tensor:
        fused = torch.cat([text_vec, image_vec], dim=-1)
        return F.normalize(fused, p=2, dim=-1)


class ProjectionFusion(nn.Module):
    """
    Learned projection: [text | image] → Linear → ReLU → Linear → fusion_dim.
    Preferred: compact fixed-size output regardless of encoder dims.
    """

    def __init__(self, text_dim: int, image_dim: int, fusion_dim: int = 256):
        super().__init__()
        in_dim = text_dim + image_dim
        self.net = nn.Sequential(
            nn.Linear(in_dim, fusion_dim * 2),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(fusion_dim * 2, fusion_dim),
        )
        self.output_dim = fusion_dim

    def forward(self, text_vec: torch.Tensor, image_vec: torch.Tensor) -> torch.Tensor:
        combined = torch.cat([text_vec, image_vec], dim=-1)
        fused    = self.net(combined)
        return F.normalize(fused, p=2, dim=-1)


# ── Bi-Encoder (full model) ───────────────────────────────────────────────────

class BiEncoder(nn.Module):
    """
    Complete multimodal bi-encoder.

    encode_query(texts)              → (B, fusion_dim)   [image = zeros]
    encode_products(texts, images)  → (B, fusion_dim)
    """

    def __init__(
        self,
        text_encoder_name: str = "sentence-transformers/all-MiniLM-L6-v2",
        image_encoder_name: str = "openai/clip-vit-base-patch32",
        fusion_dim: int = 256,
        fusion_strategy: str = "projection",   # "projection" | "concat"
    ):
        super().__init__()
        self.text_encoder  = TextEncoder(text_encoder_name)
        self.image_encoder = ImageEncoder(image_encoder_name)

        text_dim  = self.text_encoder.output_dim
        image_dim = self.image_encoder.output_dim

        if fusion_strategy == "projection":
            self.fusion = ProjectionFusion(text_dim, image_dim, fusion_dim)
        elif fusion_strategy == "concat":
            self.fusion = ConcatFusion(text_dim, image_dim)
        else:
            raise ValueError(f"Unknown fusion_strategy: {fusion_strategy}")

        self.embedding_dim = self.fusion.output_dim

    def _encode(
        self,
        texts: list[str],
        images: torch.Tensor,
        device: torch.device,
        max_length: int = 128,
    ) -> torch.Tensor:
        tokenized = self.text_encoder.tokenize(texts, max_length)
        input_ids      = tokenized["input_ids"].to(device)
        attention_mask = tokenized["attention_mask"].to(device)
        images         = images.to(device)

        text_vec  = self.text_encoder(input_ids, attention_mask)
        image_vec = self.image_encoder(images)
        return self.fusion(text_vec, image_vec)

    def encode_query(
        self,
        texts: list[str],
        device: torch.device,
    ) -> torch.Tensor:
        """Encode buyer query (text only; image = zeros)."""
        B = len(texts)
        # Zero image → no visual signal for queries (by design)
        dummy_images = torch.zeros(B, 3, 224, 224, device=device)
        return self._encode(texts, dummy_images, device)

    def encode_products(
        self,
        texts: list[str],
        images: torch.Tensor,
        device: torch.device,
    ) -> torch.Tensor:
        """Encode seller products (text + image)."""
        return self._encode(texts, images, device)

    def forward(
        self,
        query_texts: list[str],
        pos_texts: list[str],
        pos_images: torch.Tensor,
        neg_texts: list[str],
        neg_images: torch.Tensor,
        device: torch.device,
    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """
        Forward pass for triplet training.
        Returns (query_emb, pos_emb, neg_emb).
        """
        q   = self.encode_query(query_texts, device)
        pos = self.encode_products(pos_texts, pos_images, device)
        neg = self.encode_products(neg_texts, neg_images, device)
        return q, pos, neg
