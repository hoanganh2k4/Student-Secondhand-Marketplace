"""
scripts/search.py
Quick CLI for testing a query against the index (no API server needed).

Usage:
    python scripts/search.py "iPhone 14 Pro 256GB màu tím" \
        --index   models/faiss_index \
        --top_k   5
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import torch

from src.inference import MatchingPipeline
from src.utils import load_config, get_device


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("query",                    nargs="?",
                        default="iPhone 14 Pro 256GB màu tím")
    parser.add_argument("--config",                 default="configs/config.yaml")
    parser.add_argument("--index",                  default="models/faiss_index")
    parser.add_argument("--top_k",                  type=int, default=5)
    parser.add_argument("--biencoder_checkpoint",   default=None)
    parser.add_argument("--reranker_checkpoint",    default=None)
    args = parser.parse_args()

    cfg    = load_config(args.config)
    device = get_device()

    pipeline = MatchingPipeline.from_config(
        cfg, device,
        biencoder_checkpoint = args.biencoder_checkpoint,
        reranker_checkpoint  = args.reranker_checkpoint,
        index_path           = args.index,
    )

    results = pipeline.search(args.query)[:args.top_k]

    print(f"\n🔍 Query: {args.query}\n")
    print(f"{'Rank':<5} {'Score':>7} {'Product ID':<10} {'Title'}")
    print("-" * 70)
    for r in results:
        score = r.get("rerank_score") or r.get("retrieval_score", 0)
        print(f"  {r['rank']:<3} {score:>7.4f}  {r['product_id']:<10} {r['title']}")

    print()
    print(json.dumps(results[0], ensure_ascii=False, indent=2) if results else "No results.")


if __name__ == "__main__":
    main()
