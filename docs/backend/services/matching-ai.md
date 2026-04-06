# AI Matching Microservice

> Location: `multimodal-matching/`
> Language: Python 3.10 · PyTorch · FastAPI
> Serves: `POST /search` — semantic product search for the marketplace
> Companion doc: [matching-engine.md](matching-engine.md) — rule-based scoring layer

---

## Why a Separate Microservice

The Next.js app handles structured rule-based scoring (price, condition, location, quantity).
The AI service handles *unstructured, language-level* matching: a buyer writes "laptop sinh viên giá rẻ" and the system must return actual laptops — not backpacks labelled "Ba lô đựng laptop".

Key problems the AI layer solves:
- **Context-word confusion** — "ba lô đựng laptop" ≠ "laptop"
- **Vietnamese natural language** — multilingual encoder (`paraphrase-multilingual-MiniLM-L12-v2`)
- **Attribute-aware ranking** — query "áo đen size L" should rank black-L items above black-XL
- **Category routing** — "laptop" → search electronics sub-index only (1,999 products, not 6,900)

---

## Pipeline Overview

```
Query (Vietnamese free text)
        │
        ▼
┌───────────────────────────────────────┐
│  Stage 0 — QueryParser                │
│  • extract color / size / gender /    │
│    brand / condition / product_type   │
│  • build enriched_query string        │
│  • CategoryClassifier (MLP) routes    │
│    to sub-index (val_acc = 0.947)     │
└────────────────┬──────────────────────┘
                 │
                 ▼
┌───────────────────────────────────────┐
│  Stage 1 — CategoryRouter             │
│  • selects FAISS sub-index per cat    │
│    (electronics 1999, fashion 2096…)  │
│  • pre-filters price > 2× budget      │
└────────────────┬──────────────────────┘
                 │
                 ▼
┌───────────────────────────────────────────────────┐
│  Stage 2 — Hybrid Retrieval (RRF fusion)          │
│                                                   │
│  Dense: BiEncoder (text+image) → FAISS top-K      │
│    text: paraphrase-multilingual-MiniLM-L12-v2    │
│    image: CLIP ViT-B/32 (zero-tensor if no image) │
│    fusion: projection head → 256-dim L2-normed    │
│                                                   │
│  Lexical: BM25 (rank-bm25)                        │
│    doc text: subcategory×4 + category + title +   │
│    description  (sub×4 gives TF dominance)        │
│                                                   │
│  Merge: RRF  score = Σ 1/(60+rank)                │
└────────────────────────┬──────────────────────────┘
                         │
                         ▼
┌───────────────────────────────────────────────────┐
│  Stage 3 — IntentAwareReranker                    │
│  • graded attribute scoring:                      │
│    color: exact=1.0 / same-family=0.5 / diff=0.0 │
│    size:  exact=1.0 / adjacent=0.7 / miss=0.0    │
│    gender: exact=1.0 / unisex=0.7 / miss=0.0     │
│  • price hard cap (> 2× budget → dropped)         │
│  • condition boost/penalty                        │
│  • diversity penalty (same seller / same item)    │
│  • why_this_result explanation list               │
└────────────────────────┬──────────────────────────┘
                         │
                         ▼
               Ranked results + why_this_result
```

---

## Directory Structure

```
multimodal-matching/
├── configs/
│   ├── config.yaml               — main config (batch_size=16, epochs=5)
│   └── config_adversarial.yaml   — fine-tune config (frozen encoders, lr=5e-6)
├── data/
│   └── processed/
│       ├── catalog.jsonl         — 6,900 products
│       ├── train.jsonl           — 40,287 triplets (incl. 2,112 adversarial)
│       ├── val.jsonl             — 5,613 triplets
│       ├── parser_train.jsonl    — 22,950 category classifier queries
│       ├── adv_train.jsonl       — 3,812 adversarial triplets only
│       └── adv_val.jsonl         — 588 adversarial triplets only
├── models/
│   └── faiss_index/
│       ├── index.faiss           — FAISS flat index (6,900 × 256-dim)
│       ├── metadata.pkl          — product IDs + metadata
│       └── bm25.pkl              — BM25 index (6,900 documents)
├── checkpoints/
│   ├── stage0/
│   │   └── category_clf.pt       — CategoryClassifier (val_acc=0.947)
│   └── biencoder/
│       └── checkpoint_best.pt    — BiEncoder (adversarially fine-tuned)
├── src/
│   ├── catalog/
│   │   └── canonicalizer.py      — extract color/size/brand/type from seller text
│   ├── data/__init__.py          — TripletDataset, CatalogDataset, DataLoader factory
│   ├── embedding/__init__.py     — BiEncoder: TextEncoder + ImageEncoder + ProjectionFusion
│   ├── pipeline/
│   │   ├── __init__.py           — MultiStagePipeline.from_config() + .search()
│   │   ├── stage0/__init__.py    — QueryParser, CategoryClassifier, extract_* functions
│   │   ├── stage1/__init__.py    — CategoryRouter, ProductIndex, sub-index building
│   │   └── stage3/__init__.py    — IntentAwareReranker, graded scoring, why_this_result
│   ├── retrieval/
│   │   ├── __init__.py           — ProductIndex (FAISS wrapper)
│   │   ├── bm25.py               — BM25Retriever (rank-bm25)
│   │   └── merger.py             — reciprocal_rank_fusion()
│   ├── reranking/__init__.py     — MultimodalReranker, RerankerInference
│   ├── training/__init__.py      — BiEncoderTrainer (frozen encoders for 4GB GPU)
│   └── utils/__init__.py         — load_config, get_logger, get_device
├── scripts/
│   ├── generate_large_dataset.py — generate catalog + triplets + adversarial data
│   ├── build_index.py            — build FAISS + BM25 index
│   ├── train_pipeline.py         — train Stage 0 (+ calls BiEncoder train)
│   └── train.py                  — train BiEncoder / Reranker
└── requirements.txt
```

---

## Models

| Component | Model | Params | Notes |
|-----------|-------|--------|-------|
| Text encoder | `paraphrase-multilingual-MiniLM-L12-v2` | 118M | frozen during fine-tune |
| Image encoder | CLIP `ViT-B/32` | 151M | frozen during fine-tune |
| Fusion head | `ProjectionFusion` (Linear→ReLU→Linear) | ~400K | only trained component |
| Category classifier | `CategoryClassifier` (MLP 384→128→6) | ~50K | val_acc=0.947 |

---

## Training

### Data

| File | Count | Description |
|------|-------|-------------|
| `catalog.jsonl` | 6,900 | Products (electronics 29%, fashion 30%, sports 16%, books 10%, vehicles 8%, furniture 7%) |
| `train.jsonl` | 40,287 | Triplets (query, positive, negative) — 4 hardness levels + adversarial |
| `adv_train.jsonl` | 3,812 | Adversarial: query="laptop" / pos=laptop / neg="Ba lô đựng laptop" |
| `parser_train.jsonl` | 22,950 | Category classifier training queries |

### Triplet Hardness Levels

| Level | Description | % of data |
|-------|-------------|-----------|
| L1 | Different category entirely (easy negative) | 10% |
| L2 | Same category, different subcategory | 20% |
| L3 | Same subcategory, different brand/attributes | 35% |
| L4 | Same subcategory + brand, different color/size | 35% |
| Adversarial | Context-word confusion (ba lô đựng laptop ≠ laptop) | ~5% |

### Stage 0 — CategoryClassifier

```bash
python3 scripts/train_pipeline.py --stage 0 --epochs 20
# Best val_acc: 0.947
# Checkpoint: checkpoints/stage0/category_clf.pt
```

### Stage 2 — BiEncoder (4GB GPU, frozen encoders)

```bash
PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True \
python3 scripts/train.py \
  --config configs/config_adversarial.yaml \
  --model biencoder \
  --resume checkpoints/biencoder/checkpoint_best.pt
# ~3 epochs, ~717 steps, ~4 minutes on RTX 3050
# Checkpoint: checkpoints/biencoder/checkpoint_best.pt
```

> **Why frozen encoders?** GPU VRAM = 4GB. Full BiEncoder + Adam optimizer ≈ 5GB.
> Freezing text + image encoders leaves only the 400K-param fusion head trainable → fits 4GB.

### Full pipeline (from scratch)

```bash
python3 scripts/generate_large_dataset.py
python3 scripts/build_index.py
python3 scripts/train_pipeline.py --stage all --epochs 20
python3 scripts/build_index.py \
  --checkpoint checkpoints/biencoder/checkpoint_best.pt
```

---

## ProductCanonicalizer

Runs at index build time (`build_index.py`). Parses seller text to extract structured attributes used by Stage 3 attribute scoring.

```python
canonicalizer = ProductCanonicalizer()
attrs = canonicalizer.canonicalize(
    title="Ba lô đen size M Nike",
    description="..."
)
# → {"color": "black", "size": "M", "gender": None,
#    "brand": "nike", "product_type": "backpack", "condition": None}
```

---

## Graded Attribute Scoring (Stage 3)

| Attribute | Exact | Partial | Miss |
|-----------|-------|---------|------|
| color | 1.0 | 0.5 (same color family) | 0.0 |
| size | 1.0 | 0.7 (adjacent: M↔L) | 0.0 |
| gender | 1.0 | 0.7 (unisex) | 0.0 |
| brand | 1.0 | — | 0.0 |
| product_type | 1.0 | — | 0.0 |

Color families: `{red, pink, coral}`, `{blue, navy, teal}`, `{black, charcoal, dark_gray}`, etc.

---

## API

```
POST /search
{
  "query": "laptop sinh viên giá rẻ",
  "top_k": 10,
  "price_max": 8000000
}

→ {
  "results": [
    {
      "rank": 1,
      "product_id": "p0001",
      "title": "Lenovo ThinkPad T14s RAM 16GB",
      "subcategory": "laptop",
      "price": 7500000,
      "rerank_score": 0.0161,
      "why_this_result": ["price within budget", "match product_type=laptop"],
      "intent_signals": {
        "price_ok": true,
        "attribute_hits": {"product_type": 1.0}
      }
    }
  ],
  "parsed_query": {
    "normalized": "laptop sinh vien gia re",
    "product_type": {"raw": "laptop", "normalized": "laptop"},
    "top_category": "electronics"
  }
}
```

---

## Integration with Next.js

```typescript
// lib/matching/ai/semantic-search.ts
export async function semanticSearch(query: string, priceMax?: number) {
  const res = await fetch(`${process.env.AI_SERVICE_URL}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, top_k: 20, price_max: priceMax }),
  })
  return res.json()
}
```

Environment variable: `AI_SERVICE_URL=http://localhost:8000` (dev) or Docker/VPS URL (prod).
