# AI Service API — FastAPI

> Platform: Python 3.10 · FastAPI · PyTorch
> Location: `multimodal-matching/`
> Base URL: `AI_SERVICE_URL` env var (default: `http://localhost:8000`)
> See [web-api.md](web-api.md) for the Next.js web API.
> See [../services/matching-ai.md](../services/matching-ai.md) for full pipeline architecture.

---

## Endpoints

### POST /search

Semantic product search using the 4-stage MultiStagePipeline.

**Request:**
```json
{
  "query":     "laptop sinh viên giá rẻ",
  "top_k":     10,
  "price_max": 8000000
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | ✓ | Vietnamese free-text query |
| `top_k` | int | — | Max results to return (default: 10) |
| `price_max` | int | — | Pre-filter: drop products above this price |

**Response:**
```json
{
  "results": [
    {
      "rank":           1,
      "product_id":     "p0001",
      "title":          "Lenovo ThinkPad T14s RAM 16GB",
      "subcategory":    "laptop",
      "category":       "electronics",
      "price":          7500000,
      "condition":      "like_new",
      "location":       "Hanoi",
      "retrieval_score": 0.0261,
      "rerank_score":   0.0161,
      "why_this_result": [
        "price within budget",
        "match product_type=laptop"
      ],
      "intent_signals": {
        "price_ok":        true,
        "price_penalty":   0.0,
        "condition_adj":   0.0,
        "attribute_hits":  { "product_type": 1.0 },
        "diversity_pen":   0.0
      }
    }
  ],
  "parsed_query": {
    "raw":           "laptop sinh viên giá rẻ",
    "normalized":    "laptop sinh vien gia re",
    "enriched":      "laptop",
    "top_category":  "electronics",
    "product_type":  { "raw": "laptop", "normalized": "laptop" },
    "color":         null,
    "size":          null,
    "brand":         null,
    "gender":        null,
    "price_max":     null,
    "condition":     null
  },
  "latency_ms": 45
}
```

---

### GET /health

Liveness check.

**Response:**
```json
{ "status": "ok", "index_size": 6900, "bm25_loaded": true }
```

---

### GET /debug/parse?query=...

Parse query without running retrieval — useful for debugging Stage 0.

**Response:**
```json
{
  "normalized":    "ao khoac nam den size l",
  "enriched":      "outerwear male black L",
  "top_category":  "fashion",
  "confidence":    0.9987,
  "product_type":  "outerwear",
  "color":         "black",
  "size":          "L",
  "gender":        "male",
  "brand":         null
}
```

---

## Pipeline Stages

| Stage | Component | What it does |
|-------|-----------|-------------|
| 0 | `QueryParser` | Extract intent, route to sub-index via `CategoryClassifier` (val_acc=0.947) |
| 1 | `CategoryRouter` | Select FAISS sub-index, apply pre-filters |
| 2 | `BiEncoder` + `BM25Retriever` | Dense + lexical retrieval, merged with RRF |
| 3 | `IntentAwareReranker` | Graded attribute scoring, why_this_result |

## Graded Attribute Scoring

| Attribute | Exact | Partial | Miss |
|-----------|-------|---------|------|
| color | 1.0 | 0.5 (same family) | 0.0 |
| size | 1.0 | 0.7 (adjacent: M↔L) | 0.0 |
| gender | 1.0 | 0.7 (unisex) | 0.0 |
| brand | 1.0 | — | 0.0 |
| product_type | 1.0 | — | 0.0 |

---

## Integration Pattern (Next.js)

```typescript
// lib/matching/ai/semantic-search.ts
export async function semanticSearch(
  query: string,
  options?: { topK?: number; priceMax?: number }
) {
  const res = await fetch(`${process.env.AI_SERVICE_URL}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      top_k:     options?.topK ?? 20,
      price_max: options?.priceMax,
    }),
  })
  if (!res.ok) throw new Error(`AI service error: ${res.status}`)
  return res.json()
}
```

**Timeout policy:** 2-second timeout. On timeout, fall back to rule-based results only (rule R-M8).

---

## Running Locally

```bash
cd multimodal-matching
uvicorn src.api:app --host 0.0.0.0 --port 8000 --reload
```

**Rebuild index after retraining:**
```bash
python3 scripts/build_index.py \
  --checkpoint checkpoints/biencoder/checkpoint_best.pt
```
