"""
src/data/__init__.py
Data pipeline: loading catalog, triplets, image preprocessing.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import torch
from PIL import Image
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms


# ── Image Transform ────────────────────────────────────────────────────────────

def get_image_transform(image_size: int = 224) -> transforms.Compose:
    """Standard ImageNet-style transform for CLIP / ViT models."""
    return transforms.Compose([
        transforms.Resize((image_size, image_size)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.48145466, 0.4578275, 0.40821073],   # CLIP means
            std=[0.26862954, 0.26130258, 0.27577711],
        ),
    ])


def load_image(path_or_url: str | None, transform: transforms.Compose) -> torch.Tensor:
    """
    Load an image from disk path or return a zero tensor if unavailable.
    Zero tensor = graceful degradation when no image exists.
    """
    size = 224  # infer from transform if needed
    zero = torch.zeros(3, size, size)

    if path_or_url is None:
        return zero

    try:
        if path_or_url.startswith("http"):
            import requests
            from io import BytesIO
            resp = requests.get(path_or_url, timeout=5)
            img = Image.open(BytesIO(resp.content)).convert("RGB")
        else:
            img = Image.open(path_or_url).convert("RGB")
        return transform(img)
    except Exception:
        return zero


# ── Catalog ───────────────────────────────────────────────────────────────────

def load_catalog(path: str | Path) -> dict[str, dict[str, Any]]:
    """
    Load product catalog from a JSONL file.

    Returns:
        Dict mapping product_id → product dict.
    """
    catalog: dict[str, dict[str, Any]] = {}
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Catalog not found: {path}")

    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            product = json.loads(line)
            catalog[product["product_id"]] = product

    return catalog


# ── Triplet Dataset ────────────────────────────────────────────────────────────

class TripletDataset(Dataset):
    """
    PyTorch Dataset that yields (query, positive_product, negative_product) triplets.

    Each item is a dict:
        {
            "query_text":       str,
            "pos_text":         str,
            "neg_text":         str,
            "pos_image":        Tensor[3, H, W],
            "neg_image":        Tensor[3, H, W],
        }
    """

    def __init__(
        self,
        triplet_path: str | Path,
        catalog: dict[str, dict[str, Any]],
        image_size: int = 224,
    ):
        self.catalog = catalog
        self.transform = get_image_transform(image_size)
        self.triplets: list[dict[str, Any]] = []

        with open(triplet_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    self.triplets.append(json.loads(line))

    def _product_text(self, pid: str) -> str:
        p = self.catalog.get(pid, {})
        title = p.get("title", "")
        desc = p.get("description", "")
        return f"{title}. {desc}".strip()

    def _product_image(self, pid: str) -> torch.Tensor:
        p = self.catalog.get(pid, {})
        img_path = p.get("image_path") or p.get("image_url")
        return load_image(img_path, self.transform)

    def __len__(self) -> int:
        return len(self.triplets)

    def __getitem__(self, idx: int) -> dict[str, Any]:
        t = self.triplets[idx]
        pos_id = t["positive_product_id"]
        neg_id = t["negative_product_id"]

        return {
            "query_text": t["query"],
            "pos_text":   self._product_text(pos_id),
            "neg_text":   self._product_text(neg_id),
            "pos_image":  self._product_image(pos_id),
            "neg_image":  self._product_image(neg_id),
        }


# ── Catalog Dataset (for building index) ──────────────────────────────────────

class CatalogDataset(Dataset):
    """
    Simple dataset over catalog products for batch embedding generation.
    Used when building the FAISS index.
    """

    def __init__(
        self,
        catalog: dict[str, dict[str, Any]],
        image_size: int = 224,
    ):
        self.products = list(catalog.values())
        self.transform = get_image_transform(image_size)

    def __len__(self) -> int:
        return len(self.products)

    def __getitem__(self, idx: int) -> dict[str, Any]:
        p = self.products[idx]
        title = p.get("title", "")
        desc = p.get("description", "")
        text = f"{title}. {desc}".strip()
        img_path = p.get("image_path") or p.get("image_url")
        image = load_image(img_path, self.transform)

        return {
            "product_id": p["product_id"],
            "text": text,
            "image": image,
            "metadata": {
                **{k: (p.get(k) or "") for k in
                   ("title", "description", "condition", "category", "subcategory", "location")},
                "price": p.get("price") or 0,
            },
        }


# ── DataLoader Factory ─────────────────────────────────────────────────────────

def build_dataloaders(
    train_path: str,
    val_path: str,
    catalog: dict[str, dict[str, Any]],
    batch_size: int = 32,
    image_size: int = 224,
    num_workers: int = 2,
) -> tuple[DataLoader, DataLoader]:
    """Build train and validation DataLoaders."""
    train_ds = TripletDataset(train_path, catalog, image_size)
    val_ds   = TripletDataset(val_path,   catalog, image_size)

    train_dl = DataLoader(
        train_ds, batch_size=batch_size, shuffle=True,
        num_workers=num_workers, pin_memory=True,
    )
    val_dl = DataLoader(
        val_ds, batch_size=batch_size, shuffle=False,
        num_workers=num_workers, pin_memory=True,
    )
    return train_dl, val_dl
