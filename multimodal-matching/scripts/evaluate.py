"""
scripts/evaluate.py
Evaluate the full 2-stage pipeline on a validation set.

Loads:
  - val.jsonl (triplet file — we use positive_product_id as the ground truth)
  - catalog.jsonl
  - FAISS index
  - Optionally: bi-encoder checkpoint, reranker checkpoint

Usage:
    python scripts/evaluate.py \
        --config  configs/config.yaml \
        --index   models/faiss_index \
        --val     data/processed/val.jsonl \
        --catalog data/processed/catalog.jsonl \
        [--biencoder_checkpoint checkpoints/biencoder/checkpoint_best.pt] \
        [--reranker_checkpoint  checkpoints/reranker/checkpoint_best.pt]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import torch
from tqdm import tqdm

from src.inference import MatchingPipeline
from src.inference.evaluation import Evaluator
from src.utils import load_config, get_logger, get_device

logger = get_logger("evaluate")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config",                 default="configs/config.yaml")
    parser.add_argument("--index",                  default="models/faiss_index")
    parser.add_argument("--val",                    default="data/processed/val.jsonl")
    parser.add_argument("--catalog",                default="data/processed/catalog.jsonl")
    parser.add_argument("--biencoder_checkpoint",   default=None)
    parser.add_argument("--reranker_checkpoint",    default=None)
    parser.add_argument("--stage",                  choices=["1", "2", "both"], default="both",
                        help="Evaluate stage 1 only, stage 2 only, or both")
    args = parser.parse_args()

    cfg    = load_config(args.config)
    device = get_device()
    logger.info(f"Device: {device}")

    # ── Load pipeline ────────────────────────────────────────────────────────
    pipeline = MatchingPipeline.from_config(
        cfg, device,
        biencoder_checkpoint = args.biencoder_checkpoint,
        reranker_checkpoint  = args.reranker_checkpoint if args.stage != "1" else None,
        index_path           = args.index,
    )

    # ── Load val queries ─────────────────────────────────────────────────────
    queries: list[dict] = []
    with open(args.val) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                queries.append(json.loads(line))

    logger.info(f"Evaluating on {len(queries)} queries...")

    # ── Stage 1 eval: recall of retrieval (before re-ranking) ───────────────
    if args.stage in ("1", "both"):
        eval_s1 = Evaluator(ks=[1, 5, 10, 50, 100])

        for q in tqdm(queries, desc="Stage 1 eval"):
            query_emb  = pipeline.bi_encoder.encode_query([q["query"]], device)
            candidates = pipeline.product_index.search(query_emb, top_k=100)
            retrieved  = [c["product_id"] for c in candidates]
            relevant   = {q["positive_product_id"]}
            eval_s1.add(retrieved, relevant)

        logger.info("\n[Stage 1 - Bi-Encoder Retrieval]")
        eval_s1.print_report()

    # ── Stage 2 eval: precision of final re-ranked results ───────────────────
    if args.stage in ("2", "both") and pipeline.reranker:
        eval_s2 = Evaluator(ks=[1, 3, 5, 10])

        for q in tqdm(queries, desc="Stage 2 eval"):
            results   = pipeline.search(q["query"])
            retrieved = [r["product_id"] for r in results]
            relevant  = {q["positive_product_id"]}
            eval_s2.add(retrieved, relevant)

        logger.info("\n[Stage 2 - Full Pipeline with Re-ranking]")
        eval_s2.print_report()

    elif args.stage == "2" and not pipeline.reranker:
        logger.warning("No reranker loaded; skipping Stage 2 eval.")


if __name__ == "__main__":
    main()
