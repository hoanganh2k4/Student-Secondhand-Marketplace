"""
scripts/train.py
Train the BiEncoder (Stage 1) and optionally the Reranker (Stage 2).

Usage:
    # Train bi-encoder only
    python scripts/train.py --config configs/config.yaml --model biencoder

    # Train reranker only (requires bi-encoder checkpoint)
    python scripts/train.py --config configs/config.yaml --model reranker \
        --biencoder_checkpoint checkpoints/biencoder/checkpoint_best.pt

    # Train both sequentially
    python scripts/train.py --config configs/config.yaml --model both
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import torch

from src.data import load_catalog, build_dataloaders
from src.embedding import BiEncoder
from src.reranking import MultimodalReranker
from src.training import BiEncoderTrainer, RerankerTrainer
from src.utils import load_config, get_logger, get_device

logger = get_logger("train", log_dir="logs")


def train_biencoder(cfg, device: torch.device, checkpoint: str | None = None):
    logger.info("=" * 50)
    logger.info("Training BiEncoder")
    logger.info("=" * 50)

    catalog = load_catalog(cfg.data.catalog_path)
    train_dl, val_dl = build_dataloaders(
        cfg.data.train_path,
        cfg.data.val_path,
        catalog,
        batch_size  = cfg.training.batch_size,
        image_size  = cfg.data.image_size,
    )
    logger.info(f"Train batches: {len(train_dl)}  Val batches: {len(val_dl)}")

    model = BiEncoder(
        text_encoder_name  = cfg.model.text_encoder,
        image_encoder_name = cfg.model.image_encoder,
        fusion_dim         = cfg.model.fusion_dim,
        fusion_strategy    = cfg.model.fusion_strategy,
    )

    if checkpoint:
        ckpt = torch.load(checkpoint, map_location="cpu")
        model.load_state_dict(ckpt.get("model_state", ckpt))
        logger.info(f"Resumed from checkpoint: {checkpoint}")

    trainer = BiEncoderTrainer(model, cfg, device)
    trainer.train(train_dl, val_dl)

    best_path = Path(cfg.training.checkpoint_dir) / "biencoder" / "checkpoint_best.pt"
    logger.info(f"Best checkpoint: {best_path}")
    return best_path


def train_reranker(cfg, device: torch.device, biencoder_checkpoint: str | None = None):
    logger.info("=" * 50)
    logger.info("Training Reranker")
    logger.info("=" * 50)

    catalog = load_catalog(cfg.data.catalog_path)
    train_dl, val_dl = build_dataloaders(
        cfg.data.train_path,
        cfg.data.val_path,
        catalog,
        batch_size = cfg.reranking.batch_size,
        image_size = cfg.data.image_size,
    )

    # Share text/image encoders with bi-encoder if available
    model = MultimodalReranker(
        text_encoder_name  = cfg.model.text_encoder,
        image_encoder_name = cfg.model.image_encoder,
        hidden_dim         = cfg.reranking.hidden_dim,
    )

    trainer = RerankerTrainer(model, cfg, device)
    trainer.train(train_dl, val_dl, epochs=cfg.training.epochs // 2)

    best_path = Path(cfg.training.checkpoint_dir) / "reranker" / "checkpoint_best.pt"
    logger.info(f"Best reranker checkpoint: {best_path}")
    return best_path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config",                 default="configs/config.yaml")
    parser.add_argument("--model",                  choices=["biencoder", "reranker", "both"],
                                                    default="biencoder")
    parser.add_argument("--biencoder_checkpoint",   default=None)
    parser.add_argument("--resume",                 default=None,
                        help="Resume bi-encoder training from a checkpoint")
    args = parser.parse_args()

    cfg    = load_config(args.config)
    device = get_device()
    logger.info(f"Device: {device}")

    if args.model in ("biencoder", "both"):
        be_ckpt = train_biencoder(cfg, device, checkpoint=args.resume)
    else:
        be_ckpt = args.biencoder_checkpoint

    if args.model in ("reranker", "both"):
        train_reranker(cfg, device, biencoder_checkpoint=be_ckpt)


if __name__ == "__main__":
    main()
