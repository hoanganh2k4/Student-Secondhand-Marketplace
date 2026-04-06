# ============================================================
# DATASET FORMAT DOCUMENTATION
# ============================================================
#
# This system uses 3 data files:
#
# 1. catalog.jsonl      — Seller product listings
# 2. train.jsonl        — Training triplets
# 3. val.jsonl          — Validation triplets
#
# ============================================================

# ── catalog.jsonl ─────────────────────────────────────────
# One JSON object per line. Each seller product listing.
{
  "product_id": "p001",
  "title": "iPhone 14 Pro 256GB Deep Purple",
  "description": "Mới mua 3 tháng, còn bảo hành 9 tháng, full box, không trầy xước",
  "category": "electronics",
  "price": 22000000,
  "condition": "like_new",
  "image_path": "data/raw/images/p001.jpg",
  "image_url": "https://example.com/images/p001.jpg",  
  "location": "HCM",
  "seller_id": "s001"
}

{
  "product_id": "p002",
  "title": "Áo khoác mùa đông màu đen size L",
  "description": "Áo khoác lông vũ xuất khẩu, mặc được 2 mùa còn như mới",
  "category": "fashion",
  "price": 350000,
  "condition": "good",
  "image_path": "data/raw/images/p002.jpg",
  "image_url": null,
  "location": "Hanoi",
  "seller_id": "s002"
}


# ── train.jsonl ───────────────────────────────────────────
# Triplet format: (query, positive_product_id, negative_product_id)
# query = what buyer is looking for (text)
# positive = relevant/matching seller product
# negative = non-matching seller product (hard negatives preferred)
{
  "query_id": "q001",
  "query": "Tìm iPhone 14 Pro bộ nhớ 256GB màu tím",
  "positive_product_id": "p001",
  "negative_product_id": "p045",
  "positive_score": 1.0,
  "negative_score": 0.0
}

{
  "query_id": "q002",
  "query": "black winter jacket size L affordable",
  "positive_product_id": "p002",
  "negative_product_id": "p078",
  "positive_score": 1.0,
  "negative_score": 0.0
}


# ── val.jsonl ─────────────────────────────────────────────
# Same format as train, used for evaluation only
{
  "query_id": "qv001",
  "query": "ip14 pro 256 deep purple like new",
  "positive_product_id": "p001",
  "negative_product_id": "p099",
  "positive_score": 1.0,
  "negative_score": 0.0
}


# ============================================================
# HOW TO GENERATE SYNTHETIC DATA (for prototyping)
# Run: python scripts/generate_sample_data.py
# ============================================================
