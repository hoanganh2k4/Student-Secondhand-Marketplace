"""
scripts/generate_parser_data.py
Generate training data cho Stage 0 CategoryClassifier.

Dùng catalog.jsonl đã có → tạo (query, category_label) pairs.
Không cần Gemini API hay label thủ công.

Usage:
    python scripts/generate_parser_data.py \
        --catalog data/processed/catalog.jsonl \
        --output  data/processed/parser_train.jsonl
"""
from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

QUERY_TEMPLATES = [
    # Tự nhiên, có ý định mua
    "Tôi muốn mua {title}",
    "Tôi cần tìm {title} giá rẻ",
    "Mình đang tìm {title} secondhand còn tốt",
    "Có ai bán {title} không ạ?",
    "Ai bán {title} ib mình với",
    "Cần mua gấp {title}",
    "Tìm {title} tình trạng đẹp",
    "Bạn nào có {title} muốn thanh lý không?",
    "Cho hỏi ai đang bán {title} không?",
    "Sinh viên cần mua {title}, budget hạn chế",

    # Chỉ keyword (ngắn gọn)
    "{title} cũ",
    "{title} secondhand",
    "{title} thanh lý",
    "Mua {title}",
    "Tìm {title}",

    # Dùng từ category thay title
    "Cần mua {category_vn} cũ còn dùng tốt",
    "Tìm {category_vn} giá sinh viên",
    "Ai có {category_vn} bán không",
    "Muốn mua {category_vn} secondhand",
    "Tìm đồ {category_vn} thanh lý",
]

CATEGORY_VN = {
    "electronics": ["điện thoại", "laptop", "tai nghe", "điện tử", "thiết bị công nghệ"],
    "books":       ["sách", "giáo trình", "tài liệu học", "sách đại học"],
    "vehicles":    ["xe", "xe đạp", "xe máy", "phương tiện"],
    "furniture":   ["đồ dùng phòng trọ", "nội thất", "đồ gia dụng", "đồ sinh hoạt"],
    "fashion":     ["quần áo", "giày dép", "thời trang", "phụ kiện"],
    "sports":      ["đồ thể thao", "dụng cụ thể thao", "tập gym"],
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", default="data/processed/catalog.jsonl")
    parser.add_argument("--output",  default="data/processed/parser_train.jsonl")
    parser.add_argument("--queries_per_product", type=int, default=6)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    random.seed(args.seed)

    catalog_path = Path(args.catalog)
    if not catalog_path.exists():
        print(f"Catalog not found: {catalog_path}")
        print("Run: python scripts/generate_sample_data.py first")
        return

    products = []
    with open(catalog_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                products.append(json.loads(line))

    print(f"Loaded {len(products)} products")

    records = []
    for p in products:
        title    = p["title"]
        category = p["category"]
        cat_vns  = CATEGORY_VN.get(category, [category])

        templates = random.sample(QUERY_TEMPLATES, min(args.queries_per_product, len(QUERY_TEMPLATES)))

        for tmpl in templates:
            query = (tmpl
                     .replace("{title}",       title)
                     .replace("{category_vn}", random.choice(cat_vns)))
            records.append({
                "query":    query,
                "category": category,
            })

    # Shuffle + split 85/15
    random.shuffle(records)
    split = int(len(records) * 0.85)

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    val_path = out_path.parent / "parser_val.jsonl"

    with open(out_path, "w", encoding="utf-8") as f:
        for r in records[:split]:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    with open(val_path, "w", encoding="utf-8") as f:
        for r in records[split:]:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    print(f"✓ {split} train samples → {out_path}")
    print(f"✓ {len(records) - split} val samples  → {val_path}")

    # Print label distribution
    from collections import Counter
    dist = Counter(r["category"] for r in records[:split])
    print("\nCategory distribution (train):")
    for cat, cnt in sorted(dist.items()):
        bar = "█" * (cnt // 20)
        print(f"  {cat:<12} {cnt:>5}  {bar}")


if __name__ == "__main__":
    main()
