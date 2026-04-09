# AI API — NestJS Controller

> Controller: `backend/src/ai/ai.controller.ts`
> Base path: `/api/ai`
> Auth: Bearer JWT required on all endpoints
> Swagger tag: `AI`

---

## System

### `GET /api/ai/health`
AI service liveness + which models are loaded.

### `GET /api/ai/stats`
FAISS index sizes, model loading flags.

---

## Scoring

### `POST /api/ai/score-pairs`
Pairwise cosine similarity — used directly by the matching engine.

**Body:**
```json
{
  "query": "title: Cần mua laptop\ncategory: Electronics",
  "candidates": [
    { "id": "uuid", "text": "title: MacBook Pro\ncategory: Electronics" }
  ]
}
```

**Response:**
```json
{ "results": [{ "id": "uuid", "score": 0.757 }] }
```

---

## Vision

### `POST /api/ai/vision/extract`
Florence-2-base: extract caption, OCR, object detection from an image URL.

**Body:**
```json
{
  "image_url": "https://...",
  "tasks": ["detailed_caption", "ocr", "object_detection"]
}
```

### `POST /api/ai/vision/filter`
CLIP ViT-L/14: filter images by text query similarity.

**Body:**
```json
{ "image_urls": ["https://..."], "query": "laptop", "threshold": 0.20 }
```

### `POST /api/ai/vision/score`
CLIP: raw scores for all images (no threshold).

### `POST /api/ai/vision/listing-context`
Florence-2: generate text context from all listing images for matching.

---

## Query Understanding

### `POST /api/ai/parse`
Full Stage 0: extract hard constraints + soft preferences from free-text demand.

**Body:** `{ "query": "Cần mua laptop sinh viên budget 20 triệu" }`

### `POST /api/ai/keywords`
KeyBERT keyword extraction.

**Body:** `{ "text": "...", "top_n": 6 }`

---

## Pipeline (Debug)

### `POST /api/ai/search`
Full 4-stage pipeline (requires FAISS index built).

### `POST /api/ai/retrieve`
Stages 0+1+2 only — retrieval without reranking.

---

## Match Logs

### `GET /api/ai/match-logs`

| Query param | Type | Options |
|-------------|------|---------|
| `limit` | int | default 20 |
| `offset` | int | default 0 |
| `triggeredBy` | enum | `demand` \| `listing` |

**Response:**
```json
{
  "total": 1,
  "logs": [{
    "id": "...",
    "triggeredBy": "demand",
    "sourceText": "title: Cần mua laptop...",
    "candidateCount": 2,
    "results": [{ "id": "listing-uuid", "score": 0.757 }],
    "matchesCreated": 1
  }]
}
```

### `GET /api/ai/match-logs/:id`
Full log entry.

---

## Call Logs

### `GET /api/ai/call-logs`

| Query param | Options |
|-------------|---------|
| `endpoint` | `/score-pairs` \| `/vision/extract` \| `/vision/filter` \| `/vision/score` \| `/stage0/parse` \| ... |

Returns list view (no inputData/outputData — fetch full entry via `/:id`).

**Response:**
```json
{
  "total": 3,
  "logs": [{
    "id": "...",
    "endpoint": "/score-pairs",
    "latencyMs": 64,
    "error": null,
    "createdAt": "2026-04-09T14:57:08Z"
  }]
}
```

### `GET /api/ai/call-logs/:id`
Full entry including `inputData` and `outputData`.

---

## Training Data

### `GET /api/ai/training-data`

LTR training data: each snapshot joined with interaction labels.

| Query param | Description |
|-------------|-------------|
| `demandId` | Export one demand group only |
| `limit` | default 200 |
| `offset` | default 0 |

**Response row:**
```json
{
  "snapshotId": "...",
  "matchId": "...",
  "demandId": "...",
  "listingId": "...",
  "modelVersion": "v1",
  "rankPosition": 1,
  "candidateSetSize": 1,
  "featureVector": {
    "textScore": 0.7695,
    "finalScore": 0.7695,
    "priceRatio": 0.9,
    "conditionMatch": 1,
    "conditionGap": 1,
    "hasImage": 1,
    "hasVision": 1,
    "hasBudget": 1,
    "hasConditionPref": 1
  },
  "label": 1.0,
  "interactionCount": 4,
  "interactions": [
    { "action": "messaged", "userId": "...", "createdAt": "..." },
    { "action": "ordered",  "userId": "...", "createdAt": "..." }
  ]
}
```

**Label mapping** (highest action wins):

| Action | Label |
|--------|-------|
| `ordered` | 1.0 |
| `offered` | 0.9 |
| `messaged` | 0.7 |
| `accepted` | 0.5 |
| `detail_viewed` | 0.3 |
| `impressed` | 0.2 |
| `dismissed` | 0.0 |
| No interaction | `null` |

### `GET /api/ai/training-data/export`

Flat LTR format ready for XGBoost LambdaRank training.

| Query param | Description |
|-------------|-------------|
| `minLabel` | Filter rows below threshold (default 0) |

**Response row:**
```json
{
  "qid": "<demandId>",
  "label": 1.0,
  "features": [0.7695, 0.7695, 0.9, 1, 1, 1, 1, 1, 1, 1, 1],
  "featureNames": ["textScore","finalScore","priceRatio","conditionMatch","conditionGap",
                   "hasImage","hasVision","hasBudget","hasConditionPref","rankPosition","candidateSetSize"]
}
```

### `GET /api/ai/training-data/stats`

```json
{
  "totalSnapshots": 42,
  "totalInteractions": 87,
  "snapshotsWithInteraction": 35,
  "coverageRate": 0.83,
  "byModelVersion": { "v1": 42 },
  "byAction": { "messaged": 30, "ordered": 24, "detail_viewed": 33 }
}
```
