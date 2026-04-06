"""
scripts/build_index.py
Build FAISS product index from a catalog JSONL file.

Usage:
    python scripts/build_index.py \
        --config  configs/config.yaml \
        --catalog data/processed/catalog.jsonl \
        --output  models/faiss_index \
        --checkpoint checkpoints/biencoder/checkpoint_best.pt  # optional
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np
import torch
from torch.utils.data import DataLoader
from tqdm import tqdm

from src.catalog import ProductCanonicalizer
from src.data import load_catalog, CatalogDataset
from src.embedding import BiEncoder
from src.retrieval import ProductIndex, BM25Retriever
from src.utils import load_config, get_logger, get_device

logger = get_logger("build_index")


def build_index(
    cfg,
    catalog_path: str,
    output_path: str,
    device: torch.device,
    checkpoint: str | None = None,
) -> ProductIndex:
    logger.info(f"Loading catalog from {catalog_path}")
    catalog = load_catalog(catalog_path)
    logger.info(f"Catalog size: {len(catalog)} products")

    # ── Canonicalize product attributes ─────────────────────────────────────
    logger.info("Canonicalizing product attributes (color/size/gender/brand/type)...")
    canonicalizer = ProductCanonicalizer()
    catalog = canonicalizer.enrich_catalog(catalog)

    # ── Load model ──────────────────────────────────────────────────────────
    model = BiEncoder(
        text_encoder_name  = cfg.model.text_encoder,
        image_encoder_name = cfg.model.image_encoder,
        fusion_dim         = cfg.model.fusion_dim,
        fusion_strategy    = cfg.model.fusion_strategy,
    ).to(device).eval()

    if checkpoint:
        ckpt = torch.load(checkpoint, map_location="cpu")
        model.load_state_dict(ckpt.get("model_state", ckpt))
        logger.info(f"Loaded checkpoint: {checkpoint}")

    # ── Build embeddings ─────────────────────────────────────────────────────
    dataset    = CatalogDataset(catalog, image_size=cfg.data.image_size)
    dataloader = DataLoader(dataset, batch_size=32, shuffle=False, num_workers=0)

    all_embeddings: list[np.ndarray] = []
    all_ids:        list[str]        = []
    all_metadata:   list[dict]       = []

    logger.info("Generating product embeddings...")
    with torch.no_grad():
        for batch in tqdm(dataloader, desc="Embedding"):
            embs = model.encode_products(
                texts  = batch["text"],
                images = batch["image"],
                device = device,
            )
            all_embeddings.append(embs.cpu().numpy())
            all_ids.extend(batch["product_id"])
            all_metadata.extend([
                {
                    k: (v[i].item() if hasattr(v[i], "item") else v[i])
                    for k, v in batch["metadata"].items()
                }
                for i in range(len(batch["product_id"]))
            ])

    embeddings = np.vstack(all_embeddings).astype(np.float32)
    logger.info(f"Embeddings shape: {embeddings.shape}")

    # ── Build FAISS index ────────────────────────────────────────────────────
    index = ProductIndex(
        dim        = model.embedding_dim,
        index_type = cfg.retrieval.index_type,
        n_probe    = cfg.retrieval.n_probe,
    )
    index.add(embeddings, all_ids, all_metadata)
    index.save(output_path)
    logger.info(f"✓ FAISS index saved to {output_path}  ({len(index)} products)")

    # ── Build BM25 index ─────────────────────────────────────────────────────
    logger.info("Building BM25 index...")
    # BM25 text: repeat subcategory 4× so TF score clearly separates
    # "laptop" (subcategory=laptop) from "ba lô đựng laptop" (subcategory=backpack).
    # subcategory × 4 → TF("laptop") = 4 for real laptops, 0 for backpacks.
    bm25_texts = []
    for m in all_metadata:
        sub   = m.get("subcategory", "")
        cat   = m.get("category", "")
        title = m.get("title", "")
        desc  = m.get("description", "")
        # sub × 4 gives it dominant TF weight
        doc   = " ".join(filter(None, [sub, sub, sub, sub, cat, title, desc]))
        bm25_texts.append(doc)
    bm25 = BM25Retriever()
    bm25.build(all_ids, bm25_texts, all_metadata)
    bm25.save(output_path)
    logger.info(f"✓ BM25 index saved to {output_path}  ({len(bm25)} documents)")

    return index


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config",     default="configs/config.yaml")
    parser.add_argument("--catalog",    default="data/processed/catalog.jsonl")
    parser.add_argument("--output",     default="models/faiss_index")
    parser.add_argument("--checkpoint", default=None)
    args = parser.parse_args()

    cfg    = load_config(args.config)
    device = get_device()
    logger.info(f"Device: {device}")

    build_index(cfg, args.catalog, args.output, device, args.checkpoint)


if __name__ == "__main__":
    main()
