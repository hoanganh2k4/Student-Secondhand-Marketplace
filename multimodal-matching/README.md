# Multimodal Matching — AI Service

FastAPI service chạy trên port **8000**.  
Được NestJS backend gọi để score demand↔listing pairs, extract image attributes, và filter images.

> **Hai phần trong repo này:**
> 1. **Production endpoints** — `/score-pairs`, `/vision/extract`, `/vision/filter` — dùng trực tiếp bởi backend
> 2. **Research pipeline** — 4-stage retrieval pipeline (Stage 0–3) — dùng để nghiên cứu và train model

---

## Chạy nhanh (production mode)

```bash
cd multimodal-matching
pip install -r requirements.txt

# Chỉ cần SentenceTransformer + Florence-2 + CLIP — không cần FAISS index
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

**Swagger UI:** `http://localhost:8000/docs`

Các model được tải **lazy** (lần đầu gọi endpoint), nên startup nhanh.

---

## Endpoints dùng bởi backend

### `POST /score-pairs` — Semantic similarity

Dùng **SentenceTransformer** (`paraphrase-multilingual-MiniLM-L12-v2`) để tính cosine similarity giữa demand text và các listing text candidates.

```bash
curl -X POST http://localhost:8000/score-pairs \
  -H "Content-Type: application/json" \
  -d '{
    "query": "title: Cần laptop sinh viên\ncategory: Laptop\ndescription: Dùng lập trình, budget 8 triệu",
    "candidates": [
      {"id": "uuid-1", "text": "title: MacBook Air M1\ncategory: Laptop\ndescription: Máy đẹp, pin tốt"},
      {"id": "uuid-2", "text": "title: Áo khoác nam\ncategory: Thời trang"}
    ]
  }'
```

```json
{
  "query": "...",
  "results": [
    {"id": "uuid-1", "score": 0.7695},
    {"id": "uuid-2", "score": 0.1203}
  ],
  "total": 2,
  "latency_ms": 142.5
}
```

> Scores là cosine similarity (0–1), sorted descending.  
> Text format: `title: ...\ncategory: ...\ndescription: ...\nvision: ...` (hard-cap 512 chars)

---

### `POST /vision/extract` — Florence-2 image attributes

Dùng **Florence-2-base** (232M params, CPU-friendly) để extract caption, OCR, object detection từ ảnh sản phẩm.

```bash
curl -X POST http://localhost:8000/vision/extract \
  -H "Content-Type: application/json" \
  -d '{
    "image_url": "http://localhost:9000/marketplace-assets/listings/abc.jpg",
    "tasks": ["caption", "ocr"]
  }'
```

```json
{
  "image_url": "...",
  "attributes": {
    "caption": "A silver laptop on a white desk",
    "ocr": "MacBook Air M1"
  },
  "latency_ms": 830.2
}
```

> Tasks: `caption`, `detailed_caption`, `ocr`, `object_detection`, `dense_caption`  
> OCR + caption được dùng làm `vision:` field trong listing text trước khi gửi tới `/score-pairs`

---

### `POST /vision/filter` — CLIP image relevance

Dùng **CLIP ViT-L/14** để filter ảnh theo query text.

```bash
curl -X POST http://localhost:8000/vision/filter \
  -H "Content-Type: application/json" \
  -d '{
    "image_urls": ["http://localhost:9000/.../img1.jpg"],
    "query": "laptop sinh viên",
    "threshold": 0.20
  }'
```

```json
{
  "query": "laptop sinh viên",
  "threshold": 0.20,
  "results": [{"url": "...", "score": 0.3142}],
  "latency_ms": 210.4
}
```

---

### `GET /health`

```json
{
  "status": "ok",
  "stage0_ready": true,
  "pipeline_ready": false,
  "sentence_encoder_loaded": true,
  "vision_enabled": true
}
```

---

## Biến môi trường

| Biến | Mặc định | Mô tả |
|------|----------|--------|
| `VISION_ENABLED` | `true` | Tắt để không load CLIP + Florence-2 |
| `MODEL_CACHE_DIR` | HuggingFace default | Cache directory cho model weights |
| `BIENCODER_CKPT` | *(none)* | Fine-tuned BiEncoder checkpoint (optional) |
| `INDEX_PATH` | `models/faiss_index` | FAISS index path (chỉ cần cho research pipeline) |
| `CONFIG_PATH` | `configs/config.yaml` | Config cho research pipeline |

---

## LTR Training Script

```bash
# Export training data từ backend, train XGBoost LambdaRank
python scripts/train_ltr.py \
  --api-url http://localhost:4000 \
  --output models/ltr_model.json

# Preview stats mà không train
python scripts/train_ltr.py --stats-only
```

Cần ít nhất 50+ matched pairs với user interactions (`messaged`, `offered`, `ordered`) để train có ý nghĩa.

---

## Docker

```bash
# Build
docker build -t multimodal-matching .

# Chạy (không cần FAISS index cho production endpoints)
docker run -p 8000:8000 \
  -e VISION_ENABLED=true \
  -v $(pwd)/models:/app/models \
  multimodal-matching

# Hoặc dùng docker-compose
docker-compose up api
```

---

## Research Pipeline (4 Stage)

Pipeline nghiên cứu đầy đủ — không dùng trực tiếp bởi backend nhưng hữu ích để cải thiện matching quality.

```
raw query
   │
   ▼
Stage 0 — Query Understanding (rule-based + KeyBERT + MLP category classifier)
   │       → ParsedQuery {hard_constraints, soft_preferences, enriched_query}
   ▼
Stage 1 — Category Router + Pre-filter
   │       → chọn sub-index (fashion, electronics, ...) hoặc full index
   ▼
Stage 2 — Hybrid Dense + Lexical Retrieval
   │       FAISS (BiEncoder) + BM25 → RRF merge → top-100 candidates
   ▼
Stage 3 — Intent-Aware Reranker
           price/condition penalty + graded attribute match + diversity → top-10
```

### Chạy research pipeline

```bash
# 1. Generate sample data
python scripts/generate_sample_data.py --n_products 500 --n_triplets 1500
python scripts/generate_enriched_data.py

# 2. Build FAISS + BM25 index
python scripts/build_index.py

# 3. (Optional) Train bi-encoder
python scripts/train_pipeline.py --model biencoder

# 4. Rebuild index với model đã train
python scripts/build_index.py --checkpoint checkpoints/biencoder/checkpoint_best.pt

# 5. Start API (với pipeline loaded)
BIENCODER_CKPT=checkpoints/biencoder/checkpoint_best.pt \
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000
```

### Research endpoints

| Method | Path | Mô tả |
|--------|------|--------|
| `POST` | `/stage0/parse` | Full ParsedQuery |
| `POST` | `/stage0/keywords` | KeyBERT keywords only |
| `POST` | `/stage1/route` | Category routing decision |
| `POST` | `/stage2/retrieve` | Candidates trước rerank |
| `POST` | `/search` | Full pipeline stages 0→3 |
| `POST` | `/index/rebuild` | Rebuild FAISS từ catalog mới |
| `GET`  | `/stats` | Index stats |

---

## Data (research pipeline)

| File | Records | Mô tả |
|------|---------|--------|
| `data/processed/catalog.jsonl` | 900 | Products: electronics/fashion/books/vehicles/furniture/sports |
| `data/processed/train.jsonl` | 2,975 | Triplets cho biencoder training |
| `data/processed/val.jsonl` | 525 | Validation triplets |
| `data/processed/parser_train.jsonl` | 6,800 | Queries + category labels cho CategoryClassifier |

```
raw query
   │
   ▼
┌─────────────────────────────────────────────────────┐
│  Stage 0 — Query Understanding                      │
│  Rule-based: price / color / size / condition        │
│              product_type / gender / brand / style  │
│  KeyBERT:    semantic keywords                      │
│  MLP (opt):  category prediction                    │
│  → ParsedQuery {hard_constraints, soft_preferences} │
│    enriched_query: structured fields dominate       │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  Stage 1 — Category Router + Pre-filter             │
│  confidence ≥ 0.35 → sub-index (fashion, ...)       │
│  confidence < 0.35 → full index (fallback an toàn)  │
│  pre-filter: drop sản phẩm >2× budget trước rerank  │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  Stage 2 — Hybrid Dense + Lexical Retrieval         │
│  FAISS (BiEncoder ANN)  ──┐                         │
│                           ├── RRF merge → top-100   │
│  BM25 (exact token match) ──┘                       │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  Stage 3 — Intent-Aware Reranker                    │
│  Hard constraint penalty: price / condition_floor   │
│  Graded attribute match:  color family / size adj / │
│                           gender compat / brand     │
│  Diversity penalty:       tránh duplicate titles    │
│  → top-10 + why_this_result per result              │
└─────────────────────────────────────────────────────┘
```

---

## Model mỗi stage

| Stage | Component | Model / Method | Notes |
|-------|-----------|---------------|-------|
| **0** | Price / Size / Color extractor | Regex + dictionary | Rule-based, không cần train |
| **0** | Product type extractor | Dictionary (~50 entries, VI→EN) | "áo khoác"→"outerwear", "laptop"→"laptop" |
| **0** | Condition extractor | Dictionary (`_HARD_CONDITION_MAP`, `_SOFT_CONDITION_MAP`) | Hard vs soft phân biệt rõ |
| **0** | Keyword extractor | **KeyBERT** + `paraphrase-multilingual-MiniLM-L12-v2` | 384-dim, hỗ trợ tiếng Việt, MMR diversity |
| **0** | Category classifier | **MLP** `384 → 128 → 6` (CategoryClassifier) | Optional — train bằng `scripts/train_pipeline.py` |
| **0** | enriched_query | Structured-first: `normalized + product_type + brand + gender + color + size` | Keywords chỉ supplement (+top-2) |
| **1** | Category Router | Dùng output Stage 0 | Không có model riêng; threshold = 0.35 |
| **1** | Pre-filter | Rule: drop price >2× budget trước rerank | Giảm noise trong candidate set |
| **2** | Text encoder | `paraphrase-multilingual-MiniLM-L12-v2` (fine-tuned) | BiEncoder text branch, 384-dim → project 256-dim |
| **2** | Image encoder | `openai/clip-vit-base-patch32` | BiEncoder image branch (optional, dùng khi có ảnh) |
| **2** | FAISS index | `IndexFlatIP` (exact) hoặc `IndexIVFFlat` (fast approx) | Inner product = cosine sau normalize |
| **2** | BM25 | `rank_bm25` (Okapi BM25) | Lexical retrieval cho exact token match |
| **2** | RRF Merger | Reciprocal Rank Fusion, k=60 | Merge FAISS + BM25 không cần score calibration |
| **3** | Hard constraint checker | Rule-based (×0.25 nếu price >115% budget) | Không cần train |
| **3** | Graded attribute scorer | Color family / size adjacency / gender compat | Partial match: color same-family=0.5, size adjacent=0.7 |
| **3** | Soft preference adjuster | Rule-based (±small adj theo condition match) | Không cần train |
| **3** | Neural reranker | **MultimodalReranker MLP** `[q|p|q*p|img] → score` | Optional — train bằng `scripts/train_pipeline.py` |
| **3** | why_this_result | Rule-based explanation generator | Hiển thị lý do ranking cho từng sản phẩm |
| **offline** | ProductCanonicalizer | Reuse Stage 0 extractors trên seller text | Trích color/size/gender/brand/type → `metadata["attributes"]` |

---

## Cài đặt

```bash
pip3 install -r requirements.txt
```

---

## Chạy từ đầu

```bash
# 1. Tạo dữ liệu mẫu (catalog + triplets cho biencoder)
python3 scripts/generate_sample_data.py --n_products 500 --n_triplets 1500

# 1b. Enrich dữ liệu: thêm fashion/sports + complex parser queries + attribute triplets
python3 scripts/generate_enriched_data.py

# 2. Build FAISS + BM25 index (canonicalize trước khi build)
python3 scripts/build_index.py --checkpoint checkpoints/biencoder/checkpoint_best.pt

# 3. (Tuỳ chọn) Train bi-encoder
python3 scripts/train_pipeline.py --model biencoder

# 4. (Tuỳ chọn) Train category classifier
python3 scripts/train_pipeline.py --model category_router

# 5. Khởi động API
BIENCODER_CKPT=checkpoints/biencoder/checkpoint_best.pt \
python3 -m uvicorn api.main:app --host 0.0.0.0 --port 8000
```

**Swagger UI:** `http://localhost:8000/docs`

---

## API Endpoints

### Stage 0 — Query Understanding
*(luôn sẵn sàng, không cần index)*

| Method | Path | Mô tả |
|--------|------|--------|
| `POST` | `/stage0/parse` | Full ParsedQuery: hard constraints + soft preferences + keywords + routing |
| `POST` | `/stage0/keywords` | **KeyBERT only** — nhanh hơn ~40ms, dùng cho autocomplete/search-as-you-type |

```bash
# Parse đầy đủ
curl -X POST http://localhost:8000/stage0/parse \
  -H "Content-Type: application/json" \
  -d '{"query": "Cần áo khoác nữ màu đen size L dưới 300k còn mới"}'

# Keywords only
curl -X POST http://localhost:8000/stage0/keywords \
  -H "Content-Type: application/json" \
  -d '{"text": "laptop cũ budget 5 triệu", "top_n": 5}'
```

**Output `/stage0/parse`:**
```json
{
  "hard_constraints": {
    "price":           {"max": {"raw": "dưới 300k", "normalized": 300000.0}},
    "condition_floor": {"raw": "còn mới", "normalized": "like_new"}
  },
  "soft_preferences": {
    "color":  {"raw": "đen",    "normalized": "black"},
    "size":   {"raw": "size l", "normalized": "L"},
    "gender": {"raw": "nữ",     "normalized": "female"}
  },
  "product_type": {"raw": "áo khoác", "normalized": "outerwear"},
  "keywords": ["áo khoác nữ", "màu đen"],
  "enriched_query": "cần áo khoác nữ màu đen size l dưới 300k còn mới outerwear female black L",
  "routing":  {"candidates": [["fashion", 0.82]], "confident": true}
}
```

> `hard_constraints`: vi phạm → penalty nặng (×0.25–0.8)  
> `soft_preferences`: không khớp → trừ điểm nhỏ, vẫn hiện sản phẩm  
> `enriched_query`: structured fields ưu tiên trước keywords  

---

### Stage 1 — Category Router
*(cần pipeline)*

| Method | Path | Mô tả |
|--------|------|--------|
| `POST` | `/stage1/route` | Xem routing decision: sub-index nào sẽ được dùng |

```bash
curl -X POST http://localhost:8000/stage1/route \
  -H "Content-Type: application/json" \
  -d '{"query": "áo khoác đen"}'
```

```json
{
  "index_used":  "sub-index 'fashion'",
  "index_size":  296,
  "confident":   true,
  "routing":     [["fashion", 0.84], ["sports", 0.11]]
}
```

---

### Stage 2 — Dense + Lexical Retrieval
*(cần pipeline)*

| Method | Path | Mô tả |
|--------|------|--------|
| `POST` | `/stage2/retrieve` | Candidates trước khi rerank — debug recall |

```bash
curl -X POST http://localhost:8000/stage2/retrieve \
  -H "Content-Type: application/json" \
  -d '{"query": "áo khoác đen", "top_k": 10}'
```

```json
{
  "candidates": [
    {"rank": 1, "title": "Áo khoác bomber đen", "retrieval_score": 0.0326, "category": "fashion"},
    {"rank": 2, "title": "Áo khoác nữ màu đen", "retrieval_score": 0.0315, "category": "fashion"}
  ],
  "total": 10,
  "latency_ms": 95.3
}
```

> `retrieval_score` là RRF score (FAISS + BM25 merged), không còn là cosine similarity thuần

---

### Full Pipeline — Stages 0 → 1 → 2 → 3

| Method | Path | Mô tả |
|--------|------|--------|
| `POST` | `/search` | Kết quả cuối cùng với `intent_signals`, `why_this_result`, `timings` |

```bash
curl -X POST http://localhost:8000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "Cần áo khoác nữ màu đen size L dưới 300k còn mới", "top_k": 5}'
```

```json
{
  "results": [
    {
      "rank": 1,
      "title": "Áo khoác bomber nữ màu đen size L",
      "price": 250000,
      "condition": "like_new",
      "rerank_score": 1.0875,
      "intent_signals": {
        "price_ok": true,
        "price_penalty": 0.0,
        "condition_adj": 0.0,
        "attribute_score": 0.950,
        "attribute_hits": {"color": 1.0, "size": 1.0, "brand": 1.0, "gender": 1.0},
        "diversity_pen": 0.0,
        "hard_violated": false
      },
      "why_this_result": [
        "price within budget (250,000đ ≤ 300,000đ)",
        "condition meets floor: like_new ≥ like_new",
        "match color=đen",
        "match size=size l",
        "match gender=nữ"
      ]
    }
  ],
  "parsed_query": { "...": "..." },
  "timings": {
    "stage0_ms": 101.0,
    "stage1_2_ms": 260.0,
    "stage3_ms": 0.5,
    "total_ms": 361.5
  }
}
```

---

### System

| Method | Path | Mô tả |
|--------|------|--------|
| `GET`  | `/health` | Trạng thái service: stage0_ready, pipeline_ready, classifier_loaded, reranker_loaded |
| `GET`  | `/stats` | Index stats: full_index size, sub_indexes breakdown, top_k config |
| `POST` | `/index/rebuild` | Rebuild FAISS index từ catalog mới |

---

## Phân biệt hard constraints vs soft preferences

**Hard constraints** — khi vi phạm, sản phẩm bị penalty nặng (score × 0.25–0.8):

| Constraint | Ví dụ query | Extracted |
|------------|-------------|-----------|
| Price max | "dưới 300k" | `hard.price.max = 300000` |
| Price min | "từ 3 triệu" | `hard.price.min = 3000000` |
| Condition floor | "còn mới", "nguyên seal" | `hard.condition_floor = "like_new"` |

**Soft preferences** — khi không khớp, graded score adjustment (exact/partial/miss):

| Preference | Ví dụ query | Extracted | Graded match |
|------------|-------------|-----------|--------------|
| Color | "màu đen" | `soft.color = "black"` | exact=1.0, same-family=0.5 (e.g. navy), miss=0.0 |
| Size | "size L" | `soft.size = "L"` | exact=1.0, adjacent=0.7 (M/XL), miss=0.0 |
| Gender | "nữ" | `soft.gender = "female"` | exact=1.0, unisex=0.7, miss=0.0 |
| Brand | "Nike" | `soft.brand = "nike"` | exact=1.0, miss=0.0 |
| Style | "bomber", "oversize" | `soft.style = "bomber"` | exact=1.0 |
| Condition preferred | "tốt", "đẹp" | `soft.condition_preferred = "good"` | ±small adj |

**Product type** — dùng để restrict index + attribute scoring:

| Ví dụ | Extracted |
|-------|-----------|
| "áo khoác" | `product_type = "outerwear"` |
| "laptop" | `product_type = "laptop"` |
| "điện thoại" | `product_type = "smartphone"` |

---

## Product Canonicalization

Khi build index, `ProductCanonicalizer` chạy offline trên seller text:

```
Áo khoác bomber nữ màu đen size L Nike
    ↓ canonicalize()
{"color": "black", "size": "L", "gender": "female", "brand": "nike",
 "product_type": "bomber_jacket", "condition": "like_new"}
```

Lưu vào `metadata["attributes"]` trong FAISS index.  
Stage 3 dùng để tính graded attribute match — nếu không có `attributes`, attribute score = 0 (fallback an toàn).

---

## Score Pipeline (Stage 3)

```
retrieval_score (RRF)
  × price_multiplier       (0.25 nếu >115% budget, 1.0 nếu ok)
  × condition_multiplier   (0.4–0.8 nếu vi phạm condition_floor)
  + attribute_score × 0.25 (graded: color + size + brand + gender + product_type)
  + condition_adj          (±0.04–0.12 soft condition preference)
  - diversity_penalty      (0.10–0.40 nếu trùng title)
= rerank_score
```

---

## Train models

```bash
# Generate data (nếu chưa có)
python3 scripts/generate_sample_data.py --n_products 500 --n_triplets 1500
python3 scripts/generate_enriched_data.py   # thêm fashion/sports + attribute triplets

# Build index (tự động canonicalize + build BM25)
python3 scripts/build_index.py

# Train bi-encoder (Stage 2 text encoder)
python3 scripts/train_pipeline.py --model biencoder

# Rebuild FAISS + BM25 index với model đã train
python3 scripts/build_index.py --checkpoint checkpoints/biencoder/checkpoint_best.pt

# Train category classifier (Stage 0 MLP)
python3 scripts/train_pipeline.py --model category_router

# Evaluate tất cả stages
python3 scripts/evaluate.py \
  --biencoder_checkpoint checkpoints/biencoder/checkpoint_best.pt
```

---

## Evaluation

### Metrics

| Category | Metric | Mô tả |
|----------|--------|--------|
| Retrieval | Recall@50, Recall@100 | % relevant products trong top-50/100 candidates |
| Ranking | MRR | Mean Reciprocal Rank — rank trung bình của result đúng đầu tiên |
| Ranking | NDCG@10 | Normalized Discounted Cumulative Gain |
| Business | Constraint satisfaction rate | % kết quả không vi phạm hard constraint |
| Business | Attribute match rate | Avg attribute_score trên top-10 kết quả |

### Ablation

| Config | Mô tả |
|--------|--------|
| dense-only | Chỉ FAISS, không BM25 |
| bm25-only | Chỉ BM25, không FAISS |
| hybrid | FAISS + BM25 + RRF |
| hybrid + attr | + graded attribute scoring |
| hybrid + attr + canon | + product canonicalization |
| full | + constraint + diversity |

---

## Docker

```bash
docker build -t multimodal-matching .

docker run -p 8000:8000 \
  -e BIENCODER_CKPT=/app/checkpoints/biencoder/checkpoint_best.pt \
  -v $(pwd)/models:/app/models \
  -v $(pwd)/checkpoints:/app/checkpoints \
  multimodal-matching
```

---

## Biến môi trường

| Biến | Mặc định | Mô tả |
|------|----------|--------|
| `BIENCODER_CKPT` | *(none)* | Path checkpoint BiEncoder fine-tuned |
| `RERANKER_CKPT` | *(none)* | Path checkpoint MultimodalReranker |
| `PARSER_CKPT` | *(none)* | Path checkpoint CategoryClassifier MLP |
| `INDEX_PATH` | `models/faiss_index` | Path FAISS + BM25 index directory |
| `KW_TOP_N` | `6` | Số keywords mặc định (Stage 0 KeyBERT) |
| `CONFIG_PATH` | `configs/config.yaml` | Path config file |

---

## Data

| File | Records | Mô tả |
|------|---------|--------|
| `data/processed/catalog.jsonl` | 900 | Products: electronics/fashion/books/vehicles/furniture/sports |
| `data/processed/train.jsonl` | 2,975 | Triplets cho biencoder training (incl. attribute-sensitive negatives) |
| `data/processed/val.jsonl` | 525 | Validation triplets |
| `data/processed/parser_train.jsonl` | 6,800 | Queries + category labels cho CategoryClassifier |
| `data/processed/parser_val.jsonl` | 1,200 | Validation queries |

Thêm data:
```bash
python3 scripts/generate_sample_data.py --n_products 500 --n_triplets 1500
python3 scripts/generate_enriched_data.py --extra_products 400 --extra_triplets 2000
```
