"""
CLIP ViT-L/14 image filter.

Usage
-----
filter = CLIPImageFilter()                         # loads model once
scores = filter.score_images(image_urls, query)    # returns List[float], range 0-1
hits   = filter.filter_by_threshold(image_urls, query, threshold=0.25)

Architecture
------------
- Model  : openai/clip-vit-large-patch14  (307M vision params, 768-dim embeddings)
- Device : CUDA if available, else CPU
- Images : downloaded on-demand, cached in memory (LRU, max 128)
- Text   : tokenised with CLIP tokenizer, normalised L2
- Output : cosine similarity between image and text embeddings
"""
from __future__ import annotations

import io
import logging
from functools import lru_cache
from typing import List, Optional, Tuple

import requests
import torch
import torch.nn.functional as F
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

logger = logging.getLogger(__name__)

_DEFAULT_MODEL = "openai/clip-vit-large-patch14"
_TIMEOUT_SEC   = 10


class CLIPImageFilter:
    """
    Wraps CLIP ViT-L/14 to score images against a text query.

    Parameters
    ----------
    model_name : str
        HuggingFace model ID.  Defaults to openai/clip-vit-large-patch14.
    device : str | None
        'cuda', 'cpu', or None (auto-detect).
    cache_dir : str | None
        Where to store downloaded model weights.
    """

    def __init__(
        self,
        model_name: str = _DEFAULT_MODEL,
        device: Optional[str] = None,
        cache_dir: Optional[str] = None,
    ) -> None:
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        logger.info("Loading %s on %s …", model_name, self.device)

        self.processor = CLIPProcessor.from_pretrained(model_name, cache_dir=cache_dir)
        self.model     = CLIPModel.from_pretrained(model_name, cache_dir=cache_dir)
        self.model.to(self.device)
        self.model.eval()

        logger.info("CLIP ViT-L/14 ready.")

    # ── Public API ─────────────────────────────────────────────────────────────

    def score_images(
        self,
        image_urls: List[str],
        query: str,
        batch_size: int = 8,
    ) -> List[float]:
        """
        Return per-image cosine similarity scores against *query*.

        Parameters
        ----------
        image_urls : list of str
            HTTP(S) URLs or local file paths.
        query : str
            Natural-language description to compare against.
        batch_size : int
            Images processed per forward pass.

        Returns
        -------
        list of float
            Values in [0, 1]; higher means more similar.
        """
        if not image_urls:
            return []

        images, valid_mask = self._load_images(image_urls)
        if not any(valid_mask):
            return [0.0] * len(image_urls)

        valid_images = [img for img, ok in zip(images, valid_mask) if ok]

        # Encode text once
        text_emb = self._encode_text(query)

        # Encode images in batches
        img_embs: List[torch.Tensor] = []
        for i in range(0, len(valid_images), batch_size):
            batch   = valid_images[i : i + batch_size]
            img_embs.append(self._encode_images(batch))

        all_img_emb = torch.cat(img_embs, dim=0)   # (N_valid, 768)
        sims        = F.cosine_similarity(all_img_emb, text_emb.expand_as(all_img_emb))

        # Re-insert 0.0 for failed downloads
        scores: List[float] = []
        valid_iter = iter(sims.tolist())
        for ok in valid_mask:
            scores.append(next(valid_iter) if ok else 0.0)

        return scores

    def filter_by_threshold(
        self,
        image_urls: List[str],
        query: str,
        threshold: float = 0.25,
    ) -> List[Tuple[str, float]]:
        """
        Return (url, score) pairs where score >= threshold.
        """
        scores = self.score_images(image_urls, query)
        return [
            (url, score)
            for url, score in zip(image_urls, scores)
            if score >= threshold
        ]

    def best_image(
        self,
        image_urls: List[str],
        query: str,
    ) -> Optional[Tuple[str, float]]:
        """
        Return the (url, score) of the highest-scoring image, or None.
        """
        if not image_urls:
            return None
        scores = self.score_images(image_urls, query)
        best_i = max(range(len(scores)), key=lambda i: scores[i])
        return image_urls[best_i], scores[best_i]

    # ── Internal helpers ───────────────────────────────────────────────────────

    @torch.no_grad()
    def _encode_text(self, text: str) -> torch.Tensor:
        inputs = self.processor(text=[text], return_tensors="pt", padding=True, truncation=True)
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        emb    = self.model.get_text_features(**inputs)
        return F.normalize(emb, dim=-1)   # (1, 768)

    @torch.no_grad()
    def _encode_images(self, images: List[Image.Image]) -> torch.Tensor:
        inputs = self.processor(images=images, return_tensors="pt")
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        emb    = self.model.get_image_features(**inputs)
        return F.normalize(emb, dim=-1)   # (B, 768)

    def _load_images(
        self, urls: List[str]
    ) -> Tuple[List[Optional[Image.Image]], List[bool]]:
        images:     List[Optional[Image.Image]] = []
        valid_mask: List[bool]                  = []

        for url in urls:
            try:
                img = _fetch_image(url)
                images.append(img)
                valid_mask.append(True)
            except Exception as exc:
                logger.warning("Failed to load image %s: %s", url, exc)
                images.append(None)
                valid_mask.append(False)

        return images, valid_mask


@lru_cache(maxsize=128)
def _fetch_image(url: str) -> Image.Image:
    """Download and cache an image by URL (LRU, thread-safe)."""
    if url.startswith(("http://", "https://")):
        resp = requests.get(url, timeout=_TIMEOUT_SEC)
        resp.raise_for_status()
        return Image.open(io.BytesIO(resp.content)).convert("RGB")
    # Local file path
    return Image.open(url).convert("RGB")
