"""
scripts/train_pipeline.py
Train tất cả các stage của MultiStagePipeline theo thứ tự.

  Stage 0: CategoryClassifier (MLP nhanh, ~1-2 phút)
  Stage 1: không cần train (rule-based)
  Stage 2: BiEncoder — đã có scripts/train.py
  Stage 3: Reranker   — đã có scripts/train.py

Usage:
    # Train toàn bộ pipeline (sau khi đã có catalog + triplet data)
    python scripts/train_pipeline.py

    # Chỉ train Stage 0 (category classifier)
    python scripts/train_pipeline.py --stage 0

    # Chỉ train Stage 0 với checkpoint biencoder sẵn có
    python scripts/train_pipeline.py --stage 0 \
        --biencoder_checkpoint checkpoints/biencoder/checkpoint_best.pt
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.optim import AdamW
from torch.utils.data import Dataset, DataLoader

from src.embedding import BiEncoder
from src.pipeline.stage0 import CategoryClassifier, CAT2IDX, CATEGORIES
from src.utils import load_config, get_logger, get_device

logger = get_logger("train_pipeline")


# ─── Stage 0 Dataset ──────────────────────────────────────────────────────────

class ParserDataset(Dataset):
    def __init__(self, path: str | Path):
        self.records = []
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    r = json.loads(line)
                    if r["category"] in CAT2IDX:
                        self.records.append(r)

    def __len__(self) -> int:
        return len(self.records)

    def __getitem__(self, idx: int) -> dict:
        return self.records[idx]


def collate_parser(batch: list[dict]) -> dict:
    return {
        "query":    [b["query"]    for b in batch],
        "category": [b["category"] for b in batch],
    }


# ─── Stage 0 Training ─────────────────────────────────────────────────────────

def train_stage0(
    cfg,
    device: torch.device,
    biencoder_checkpoint: str | None = None,
    train_path: str = "data/processed/parser_train.jsonl",
    val_path:   str = "data/processed/parser_val.jsonl",
    output_dir: str = "checkpoints/stage0",
    epochs:     int = 10,
    batch_size: int = 64,
    lr:         float = 3e-4,
):
    logger.info("=" * 50)
    logger.info("Training Stage 0 — CategoryClassifier")
    logger.info("=" * 50)

    # ── Load BiEncoder text encoder (frozen — only train MLP head) ──────────
    bi_encoder = BiEncoder(
        text_encoder_name  = cfg.model.text_encoder,
        image_encoder_name = cfg.model.image_encoder,
        fusion_dim         = cfg.model.fusion_dim,
        fusion_strategy    = cfg.model.fusion_strategy,
    ).to(device).eval()

    if biencoder_checkpoint:
        ckpt = torch.load(biencoder_checkpoint, map_location="cpu")
        bi_encoder.load_state_dict(ckpt.get("model_state", ckpt))
        logger.info(f"Loaded BiEncoder weights from {biencoder_checkpoint}")

    # Freeze the text encoder — we only train the MLP head
    for param in bi_encoder.text_encoder.parameters():
        param.requires_grad = False

    embed_dim = bi_encoder.text_encoder.output_dim
    logger.info(f"Embedding dim: {embed_dim}  |  Classes: {len(CATEGORIES)}")

    # ── Model ────────────────────────────────────────────────────────────────
    classifier = CategoryClassifier(embed_dim=embed_dim, num_classes=len(CATEGORIES)).to(device)
    optimizer  = AdamW(classifier.parameters(), lr=lr, weight_decay=1e-4)
    loss_fn    = nn.CrossEntropyLoss()

    # ── Data ─────────────────────────────────────────────────────────────────
    train_ds  = ParserDataset(train_path)
    val_ds    = ParserDataset(val_path)
    train_dl  = DataLoader(train_ds, batch_size=batch_size, shuffle=True,  collate_fn=collate_parser)
    val_dl    = DataLoader(val_ds,   batch_size=batch_size, shuffle=False, collate_fn=collate_parser)
    logger.info(f"Train: {len(train_ds)} samples  |  Val: {len(val_ds)} samples")

    best_val_acc = 0.0
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    for epoch in range(1, epochs + 1):
        # Train
        classifier.train()
        train_loss = train_correct = train_total = 0

        for batch in train_dl:
            queries = batch["query"]
            labels  = torch.tensor(
                [CAT2IDX[c] for c in batch["category"]], dtype=torch.long, device=device
            )

            with torch.no_grad():
                tokenized = bi_encoder.text_encoder.tokenize(queries)
                ids  = tokenized["input_ids"].to(device)
                mask = tokenized["attention_mask"].to(device)
                emb  = bi_encoder.text_encoder(ids, mask)   # (B, embed_dim)

            optimizer.zero_grad()
            logits = classifier(emb)
            loss   = loss_fn(logits, labels)
            loss.backward()
            optimizer.step()

            preds = logits.argmax(dim=-1)
            train_correct += (preds == labels).sum().item()
            train_total   += len(labels)
            train_loss    += loss.item() * len(labels)

        train_acc  = train_correct / train_total
        train_loss /= train_total

        # Validate
        classifier.eval()
        val_correct = val_total = 0
        with torch.no_grad():
            for batch in val_dl:
                queries = batch["query"]
                labels  = torch.tensor(
                    [CAT2IDX[c] for c in batch["category"]], dtype=torch.long, device=device
                )
                tokenized = bi_encoder.text_encoder.tokenize(queries)
                ids  = tokenized["input_ids"].to(device)
                mask = tokenized["attention_mask"].to(device)
                emb  = bi_encoder.text_encoder(ids, mask)
                logits = classifier(emb)
                preds  = logits.argmax(dim=-1)
                val_correct += (preds == labels).sum().item()
                val_total   += len(labels)

        val_acc = val_correct / val_total
        logger.info(
            f"Epoch {epoch:>2}/{epochs}  "
            f"loss={train_loss:.4f}  train_acc={train_acc:.3f}  val_acc={val_acc:.3f}"
        )

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            ckpt_path = out_path / "category_clf.pt"
            torch.save({
                "model_state": classifier.state_dict(),
                "embed_dim":   embed_dim,
                "num_classes": len(CATEGORIES),
                "hidden":      128,
                "categories":  CATEGORIES,
                "val_acc":     val_acc,
            }, ckpt_path)
            logger.info(f"  ✓ Best model saved  val_acc={val_acc:.3f}")

    logger.info(f"Stage 0 training complete. Best val_acc={best_val_acc:.3f}")
    logger.info(f"Checkpoint: {out_path / 'category_clf.pt'}")
    return out_path / "category_clf.pt"


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config",               default="configs/config.yaml")
    parser.add_argument("--stage",                default="0", choices=["0", "all"])
    parser.add_argument("--biencoder_checkpoint", default=None)
    parser.add_argument("--epochs",               type=int, default=10)
    parser.add_argument("--batch_size",           type=int, default=64)
    args = parser.parse_args()

    cfg    = load_config(args.config)
    device = get_device()
    logger.info(f"Device: {device}")

    if args.stage in ("0", "all"):
        # Check data exists
        if not Path("data/processed/parser_train.jsonl").exists():
            logger.info("Parser data not found — generating now...")
            import subprocess
            subprocess.run([
                sys.executable, "scripts/generate_parser_data.py"
            ], check=True)

        train_stage0(
            cfg,
            device,
            biencoder_checkpoint = args.biencoder_checkpoint,
            epochs               = args.epochs,
            batch_size           = args.batch_size,
        )

    if args.stage == "all":
        logger.info("\n" + "=" * 50)
        logger.info("Training Stage 2 — BiEncoder")
        logger.info("=" * 50)
        import subprocess
        biencoder_cmd = [sys.executable, "scripts/train.py", "--model", "biencoder"]
        if args.biencoder_checkpoint:
            biencoder_cmd += ["--checkpoint", args.biencoder_checkpoint]
        result = subprocess.run(biencoder_cmd, check=False)
        if result.returncode != 0:
            logger.warning("BiEncoder training failed or exited non-zero — check logs/")
        else:
            logger.info("Stage 2 BiEncoder training complete.")
            logger.info("Rebuild index with:")
            logger.info("  python scripts/build_index.py --checkpoint checkpoints/biencoder/checkpoint_best.pt")


if __name__ == "__main__":
    main()
