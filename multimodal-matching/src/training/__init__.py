"""
src/training/__init__.py
Training pipeline for BiEncoder and MultimodalReranker.

Supports:
- Triplet Loss (margin-based)
- InfoNCE / Contrastive Loss (in-batch negatives)
- Gradient accumulation
- Checkpoint saving
- Simple metrics logging
"""
from __future__ import annotations

import os
import time
from pathlib import Path
from typing import Any

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.optim import AdamW
from torch.optim.lr_scheduler import LinearLR, SequentialLR, CosineAnnealingLR
from torch.utils.data import DataLoader

from src.utils import get_logger


logger = get_logger(__name__)


# ── Loss Functions ────────────────────────────────────────────────────────────

class TripletLoss(nn.Module):
    """
    Triplet loss with cosine similarity.
    L = max(0, margin - sim(q, pos) + sim(q, neg))

    Using cosine similarity (embeddings are L2-normalised, so
    cosine sim == dot product).
    """

    def __init__(self, margin: float = 0.3):
        super().__init__()
        self.margin = margin

    def forward(
        self,
        query: torch.Tensor,    # (B, D)
        positive: torch.Tensor, # (B, D)
        negative: torch.Tensor, # (B, D)
    ) -> torch.Tensor:
        pos_sim = (query * positive).sum(dim=-1)   # (B,)
        neg_sim = (query * negative).sum(dim=-1)   # (B,)
        loss    = F.relu(self.margin - pos_sim + neg_sim)
        return loss.mean()


class InfoNCELoss(nn.Module):
    """
    In-batch contrastive loss (NT-Xent / InfoNCE).
    Uses every other sample in the batch as a negative.
    More sample-efficient than triplet loss when batch size is large.

    temperature: lower → sharper distribution → harder training.
    """

    def __init__(self, temperature: float = 0.07):
        super().__init__()
        self.temperature = temperature

    def forward(
        self,
        query: torch.Tensor,    # (B, D)
        positive: torch.Tensor, # (B, D)
        negative: torch.Tensor | None = None,  # unused for in-batch variant
    ) -> torch.Tensor:
        # Similarity matrix: rows = queries, cols = all positives in batch
        sim_matrix = torch.matmul(query, positive.T) / self.temperature  # (B, B)
        # Ground-truth: diagonal entries are the positives
        labels = torch.arange(len(query), device=query.device)
        return F.cross_entropy(sim_matrix, labels)


def build_loss(loss_type: str = "triplet", **kwargs) -> nn.Module:
    if loss_type == "triplet":
        return TripletLoss(margin=kwargs.get("margin", 0.3))
    elif loss_type in ("infonce", "contrastive"):
        return InfoNCELoss(temperature=kwargs.get("temperature", 0.07))
    else:
        raise ValueError(f"Unknown loss: {loss_type}")


# ── LR Scheduler ──────────────────────────────────────────────────────────────

def build_scheduler(optimizer, warmup_steps: int, total_steps: int):
    """Linear warmup → cosine decay."""
    warmup = LinearLR(optimizer, start_factor=0.01, end_factor=1.0, total_iters=warmup_steps)
    cosine = CosineAnnealingLR(optimizer, T_max=total_steps - warmup_steps, eta_min=1e-7)
    return SequentialLR(optimizer, schedulers=[warmup, cosine], milestones=[warmup_steps])


# ── Metrics Tracker ────────────────────────────────────────────────────────────

class MetricsTracker:
    """Rolling average tracker for training metrics."""

    def __init__(self):
        self.reset()

    def reset(self):
        self._totals: dict[str, float] = {}
        self._counts: dict[str, int]   = {}

    def update(self, metrics: dict[str, float], n: int = 1):
        for k, v in metrics.items():
            self._totals[k] = self._totals.get(k, 0.0) + v * n
            self._counts[k] = self._counts.get(k, 0)   + n

    def averages(self) -> dict[str, float]:
        return {k: self._totals[k] / self._counts[k] for k in self._totals}

    def summary(self) -> str:
        avgs = self.averages()
        return "  ".join(f"{k}={v:.4f}" for k, v in avgs.items())


# ── Bi-Encoder Training ───────────────────────────────────────────────────────

class BiEncoderTrainer:
    """
    Full training loop for the BiEncoder (Stage 1 embedding model).

    Typical call:
        trainer = BiEncoderTrainer(model, cfg, device)
        trainer.train(train_dl, val_dl)
    """

    def __init__(
        self,
        model: nn.Module,
        cfg: Any,         # Config object from utils
        device: torch.device,
    ):
        self.model  = model.to(device)
        self.device = device
        self.cfg    = cfg

        self.loss_fn = build_loss(
            cfg.training.loss,
            margin=cfg.training.margin,
        )

        # Freeze heavy pretrained encoders — only train the small fusion head.
        # This reduces GPU memory from ~5GB (full Adam) to <1GB.
        for param in model.text_encoder.parameters():
            param.requires_grad = False
        for param in model.image_encoder.parameters():
            param.requires_grad = False

        trainable = [p for p in model.parameters() if p.requires_grad]
        self.optimizer = AdamW(
            trainable,
            lr=cfg.training.lr,
            weight_decay=0.01,
        )
        self.checkpoint_dir = Path(cfg.training.checkpoint_dir) / "biencoder"
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)

    def _train_step(self, batch: dict) -> float:
        self.model.train()
        self.optimizer.zero_grad()

        q, pos, neg = self.model(
            query_texts  = batch["query_text"],
            pos_texts    = batch["pos_text"],
            pos_images   = batch["pos_image"],
            neg_texts    = batch["neg_text"],
            neg_images   = batch["neg_image"],
            device       = self.device,
        )
        loss = self.loss_fn(q, pos, neg)
        loss.backward()
        nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
        self.optimizer.step()
        return loss.item()

    @torch.no_grad()
    def _val_step(self, batch: dict) -> float:
        self.model.eval()
        q, pos, neg = self.model(
            query_texts = batch["query_text"],
            pos_texts   = batch["pos_text"],
            pos_images  = batch["pos_image"],
            neg_texts   = batch["neg_text"],
            neg_images  = batch["neg_image"],
            device      = self.device,
        )
        return self.loss_fn(q, pos, neg).item()

    def train(self, train_dl: DataLoader, val_dl: DataLoader):
        epochs  = self.cfg.training.epochs
        log_n   = self.cfg.training.log_every
        eval_n  = self.cfg.training.eval_every

        total_steps   = len(train_dl) * epochs
        scheduler     = build_scheduler(self.optimizer, self.cfg.training.warmup_steps, total_steps)
        train_tracker = MetricsTracker()
        global_step   = 0
        best_val_loss = float("inf")

        logger.info(f"Starting training: {epochs} epochs, {len(train_dl)} steps/epoch")

        for epoch in range(1, epochs + 1):
            train_tracker.reset()
            t0 = time.time()

            for batch in train_dl:
                loss = self._train_step(batch)
                train_tracker.update({"train_loss": loss}, n=len(batch["query_text"]))
                scheduler.step()
                global_step += 1

                if global_step % log_n == 0:
                    elapsed = time.time() - t0
                    logger.info(
                        f"epoch={epoch} step={global_step} "
                        f"{train_tracker.summary()}  lr={scheduler.get_last_lr()[0]:.2e}  "
                        f"elapsed={elapsed:.1f}s"
                    )

                if global_step % eval_n == 0:
                    val_loss = self._evaluate(val_dl)
                    logger.info(f"  [eval] val_loss={val_loss:.4f}")
                    if val_loss < best_val_loss:
                        best_val_loss = val_loss
                        self._save_checkpoint("best")
                        logger.info(f"  ✓ New best model saved (val_loss={val_loss:.4f})")

            self._save_checkpoint(f"epoch_{epoch}")

        logger.info("Training complete.")

    @torch.no_grad()
    def _evaluate(self, val_dl: DataLoader) -> float:
        self.model.eval()
        total, count = 0.0, 0
        for batch in val_dl:
            total += self._val_step(batch) * len(batch["query_text"])
            count += len(batch["query_text"])
        return total / count if count else 0.0

    def _save_checkpoint(self, tag: str):
        path = self.checkpoint_dir / f"checkpoint_{tag}.pt"
        torch.save({
            "model_state":     self.model.state_dict(),
            "optimizer_state": self.optimizer.state_dict(),
        }, path)


# ── Reranker Training ─────────────────────────────────────────────────────────

class RerankerTrainer:
    """
    Training loop for MultimodalReranker using pointwise BCE loss.

    Training data: same triplets — positive pair label=1, negative pair label=0.
    The reranker is trained to distinguish relevant from irrelevant products.
    """

    def __init__(self, model: nn.Module, cfg: Any, device: torch.device):
        self.model     = model.to(device)
        self.device    = device
        self.cfg       = cfg
        self.loss_fn   = nn.BCEWithLogitsLoss()
        self.optimizer = AdamW(model.parameters(), lr=cfg.training.lr * 2, weight_decay=0.01)
        self.checkpoint_dir = Path(cfg.training.checkpoint_dir) / "reranker"
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)

    def train(self, train_dl: DataLoader, val_dl: DataLoader, epochs: int = 5):
        logger.info("Training reranker...")
        best_val_loss = float("inf")

        for epoch in range(1, epochs + 1):
            self.model.train()
            tracker = MetricsTracker()

            for batch in train_dl:
                self.optimizer.zero_grad()

                # Build (query, positive) and (query, negative) pairs
                loss = self._reranker_step(batch)
                loss.backward()
                nn.utils.clip_grad_norm_(self.model.parameters(), 1.0)
                self.optimizer.step()
                tracker.update({"loss": loss.item()})

            val_loss = self._reranker_eval(val_dl)
            logger.info(f"epoch={epoch}  {tracker.summary()}  val_loss={val_loss:.4f}")

            if val_loss < best_val_loss:
                best_val_loss = val_loss
                self._save_checkpoint("best")

    def _reranker_step(self, batch: dict) -> torch.Tensor:
        tokenizer = self.model.query_encoder.st_model.tokenizer

        queries   = batch["query_text"] * 2                           # repeat for pos+neg
        products  = batch["pos_text"] + batch["neg_text"]
        labels    = torch.cat([
            torch.ones(len(batch["query_text"])),
            torch.zeros(len(batch["neg_text"])),
        ]).to(self.device)
        images    = torch.cat([batch["pos_image"], batch["neg_image"]], dim=0).to(self.device)

        q_enc = tokenizer(queries,  padding=True, truncation=True, max_length=64,  return_tensors="pt")
        p_enc = tokenizer(products, padding=True, truncation=True, max_length=128, return_tensors="pt")

        logits = self.model(
            q_enc["input_ids"].to(self.device),
            q_enc["attention_mask"].to(self.device),
            p_enc["input_ids"].to(self.device),
            p_enc["attention_mask"].to(self.device),
            images,
        )
        return self.loss_fn(logits, labels)

    @torch.no_grad()
    def _reranker_eval(self, val_dl: DataLoader) -> float:
        self.model.eval()
        total, count = 0.0, 0
        for batch in val_dl:
            loss = self._reranker_step(batch)
            total += loss.item() * len(batch["query_text"])
            count += len(batch["query_text"])
        return total / count if count else 0.0

    def _save_checkpoint(self, tag: str):
        path = self.checkpoint_dir / f"checkpoint_{tag}.pt"
        torch.save(self.model.state_dict(), path)
