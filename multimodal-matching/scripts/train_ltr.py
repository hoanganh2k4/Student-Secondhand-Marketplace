"""
LTR (Learning to Rank) training script.

Flow:
  1. Fetch training data from /api/ai/training-data/export
  2. Group by qid (demandId) — required for LambdaRank
  3. Train XGBoost LambdaRank model
  4. Evaluate NDCG@5
  5. Save model to checkpoints/ltr_v{n}.json

Usage:
  python scripts/train_ltr.py \
    --api http://localhost:4000/api \
    --token <JWT> \
    --min-label 0 \
    --output checkpoints/ltr_v1.json
"""

import argparse
import json
import os
import sys
from collections import defaultdict
from datetime import datetime

import numpy as np
import requests

# Optional deps — install with: pip install xgboost scikit-learn
try:
    import xgboost as xgb
    HAS_XGB = True
except ImportError:
    HAS_XGB = False

try:
    from sklearn.model_selection import GroupShuffleSplit
    from sklearn.metrics import ndcg_score
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False


# ── Fetch ──────────────────────────────────────────────────────────────────────

def fetch_data(api_url: str, token: str, min_label: float) -> list[dict]:
    url = f"{api_url}/ai/training-data/export?minLabel={min_label}"
    r = requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=30)
    r.raise_for_status()
    data = r.json()
    print(f"Fetched {data['count']} rows from API")
    return data["rows"]


# ── Prepare ────────────────────────────────────────────────────────────────────

def prepare(rows: list[dict]):
    """Return X (features), y (labels), groups (query group sizes)."""
    # Sort by qid so groups are contiguous
    rows.sort(key=lambda r: r["qid"])

    X, y, qids = [], [], []
    for r in rows:
        X.append(r["features"])
        y.append(r["label"])
        qids.append(r["qid"])

    X = np.array(X, dtype=np.float32)
    y = np.array(y, dtype=np.float32)

    # Group sizes for XGBoost LambdaRank
    groups = []
    current_qid, count = qids[0], 0
    for qid in qids:
        if qid == current_qid:
            count += 1
        else:
            groups.append(count)
            current_qid, count = qid, 1
    groups.append(count)

    return X, y, np.array(groups), rows[0]["featureNames"]


# ── Train ──────────────────────────────────────────────────────────────────────

def train(X, y, groups, output_path: str):
    if not HAS_XGB:
        print("xgboost not installed. Run: pip install xgboost")
        sys.exit(1)

    dtrain = xgb.DMatrix(X, label=y)
    dtrain.set_group(groups)

    params = {
        "objective":        "rank:ndcg",
        "eval_metric":      "ndcg@5",
        "eta":              0.1,
        "max_depth":        6,
        "min_child_weight": 1,
        "subsample":        0.8,
        "colsample_bytree": 0.8,
        "seed":             42,
    }

    print("Training XGBoost LambdaRank...")
    model = xgb.train(
        params,
        dtrain,
        num_boost_round=200,
        evals=[(dtrain, "train")],
        verbose_eval=50,
    )

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    model.save_model(output_path)
    print(f"Model saved → {output_path}")
    return model


# ── Evaluate ──────────────────────────────────────────────────────────────────

def evaluate(model, X, y, groups):
    dtest = xgb.DMatrix(X)
    preds = model.predict(dtest)

    # Per-query NDCG@5
    ndcg_scores = []
    start = 0
    for g in groups:
        end = start + g
        if g > 1:
            yt = y[start:end].reshape(1, -1)
            yp = preds[start:end].reshape(1, -1)
            if HAS_SKLEARN:
                ndcg_scores.append(ndcg_score(yt, yp, k=5))
        start = end

    if ndcg_scores:
        print(f"Mean NDCG@5 = {np.mean(ndcg_scores):.4f}  (over {len(ndcg_scores)} queries with >1 candidate)")
    else:
        print("Not enough multi-candidate queries to compute NDCG@5 yet — collect more data.")


# ── Stats ──────────────────────────────────────────────────────────────────────

def print_stats(rows, feature_names):
    labels = [r["label"] for r in rows]
    print(f"\n── Dataset stats ──")
    print(f"  Total rows:      {len(rows)}")
    print(f"  Unique queries:  {len(set(r['qid'] for r in rows))}")
    print(f"  Label mean:      {np.mean(labels):.3f}")
    print(f"  Label > 0.5:     {sum(l > 0.5 for l in labels)}")
    print(f"  Label = 0.0:     {sum(l == 0.0 for l in labels)}")
    print(f"  Features ({len(feature_names)}): {', '.join(feature_names)}")


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--api",       default="http://localhost:4000/api")
    parser.add_argument("--token",     required=True, help="JWT access token")
    parser.add_argument("--min-label", type=float, default=0, help="Minimum label (0–1)")
    parser.add_argument("--output",    default=f"checkpoints/ltr_v{datetime.now().strftime('%Y%m%d')}.json")
    parser.add_argument("--stats-only", action="store_true", help="Only print stats, do not train")
    args = parser.parse_args()

    rows = fetch_data(args.api, args.token, args.min_label)
    if not rows:
        print("No training data found. Create some listings, demands, and let users interact.")
        sys.exit(0)

    X, y, groups, feature_names = prepare(rows)
    print_stats(rows, feature_names)

    if args.stats_only:
        return

    if len(rows) < 10:
        print(f"\nOnly {len(rows)} rows — need more data before training meaningfully.")
        print("Minimum recommended: 50+ matched pairs with interactions.")
        sys.exit(0)

    model = train(X, y, groups, args.output)
    evaluate(model, X, y, groups)


if __name__ == "__main__":
    main()
