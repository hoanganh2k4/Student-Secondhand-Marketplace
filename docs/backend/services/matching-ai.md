# AI Matching Microservice

> Location: `multimodal-matching/`
> Language: Python 3.10 · PyTorch · FastAPI
> Port: 8000
> NestJS integration: `backend/src/ai/` (AiService + AiController)

---

## Architecture

```
NestJS Backend (port 4000)
        │
        │  POST /score-pairs   ← pairwise semantic scoring for matching
        │  POST /vision/extract ← Florence-2 caption/OCR for listing images
        │  POST /vision/filter  ← CLIP image-text similarity filter
        │  GET  /health
        │  GET  /stats
        ▼
FastAPI AI Service (port 8000)
```

All calls go through `AiService.call()` which logs every request to `AiCallLog` (endpoint, input, output, latency, error).

---

## Models

| Model | Task | Notes |
|-------|------|-------|
| `paraphrase-multilingual-MiniLM-L12-v2` | Semantic text similarity | Used in `/score-pairs` |
| `Florence-2-base` (232M params) | Image captioning, OCR, object detection | Used in `/vision/extract` |
| `CLIP ViT-L/14` | Image-text similarity | Used in `/vision/filter`, `/vision/score` |

---

## `/score-pairs` — Pairwise Semantic Scoring

The core endpoint used by the matching engine.

**Request:**
```json
{
  "query": "title: Cần mua laptop\ncategory: Electronics\n...",
  "candidates": [
    { "id": "listing-uuid-1", "text": "title: MacBook Pro\ncategory: Electronics\n..." },
    { "id": "listing-uuid-2", "text": "title: Dell XPS\n..." }
  ]
}
```

**Response:**
```json
{
  "results": [
    { "id": "listing-uuid-1", "score": 0.757 },
    { "id": "listing-uuid-2", "score": 0.612 }
  ]
}
```

- Score range: 0.0–1.0 (cosine similarity)
- Text limit: 512 characters per query/candidate
- Latency: ~50–150ms for up to 20 candidates

---

## `/vision/extract` — Florence-2 Image Analysis

Called after a listing image is uploaded. Extracts structured attributes stored in `ProofAsset.aiAttributes`.

**Request:**
```json
{
  "image_url": "https://...",
  "tasks": ["detailed_caption", "ocr", "object_detection"]
}
```

**Response:**
```json
{
  "attributes": {
    "detailed_caption": "The image shows an Apple MacBook Pro 13-inch...",
    "ocr": "MacBook Pro",
    "object_detection": "laptop, keyboard, computer"
  }
}
```

These attributes are later included in `buildListingText()` as the `vision:` field, improving semantic matching accuracy.

**Supported tasks:** `caption`, `detailed_caption`, `ocr`, `object_detection`, `dense_caption`

---

## `/vision/filter` — CLIP Image Filter

Filters a list of image URLs by relevance to a text query.

**Request:**
```json
{
  "image_urls": ["https://...", "https://..."],
  "query": "laptop computer",
  "threshold": 0.20
}
```

---

## `/stage0/parse` — Query Understanding

Parses a demand description to extract structured constraints for future Stage 0 demand enrichment.

**Request:**
```json
{ "query": "Cần mua laptop cho sinh viên, budget 15-20 triệu" }
```

**Response:**
```json
{
  "enriched_query": "laptop student 15000000-20000000 VND",
  "hard_constraints": { "budget_max": 20000000 },
  "soft_preferences": { "condition": "good", "category": "Electronics" }
}
```

---

## AiCallLog

Every call to the AI service (except `/health` and `/stats`) is logged automatically:

```typescript
// ai.service.ts — fire-and-forget in finally block
prisma.aiCallLog.create({
  data: { endpoint, inputData, outputData, latencyMs, error }
})
```

Query: `GET /api/ai/call-logs?endpoint=/score-pairs`

---

## Running Locally

```bash
cd multimodal-matching
source .venv/bin/activate
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

Or via Docker:
```bash
docker-compose up ai
```

**Required env:**
```
AI_SERVICE_URL=http://localhost:8000   # in backend/.env
```

---

## Florence-2 Known Issues

Florence-2-base requires `transformers==4.44.2` (not 5.x). Three cache locations must have the patched `modeling_florence2.py`:

- `~/.cache/huggingface/hub/models--microsoft--Florence-2-base/snapshots/.../`
- `~/.cache/huggingface/modules/transformers_modules/microsoft/Florence-2-base/.../`
- `~/.cache/huggingface/modules/transformers_modules/microsoft/Florence_hyphen_2_hyphen_base/.../`

Key patches applied:
- `flash_attn` imports in `try/except`
- `linspace(…, device='cpu')`
- `EncoderDecoderCache` → legacy tuple conversion
- `model.tie_weights()` after `.to(device)`
- `attn_implementation="eager"` in `from_pretrained()`
