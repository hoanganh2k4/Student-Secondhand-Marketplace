"""
scripts/generate_enriched_data.py
Generate enriched catalog + training data cho Vietnamese secondhand marketplace.

Mục tiêu so với generate_sample_data.py:
  1. Catalog: thêm sản phẩm với attributes rõ ràng trong title
     (color / size / gender / brand) — để canonicalization test được
  2. Parser training: thêm queries với complex attribute combinations
     (price + condition + color + size + brand)
  3. Triplets: attribute-sensitive negatives
     (same product type, wrong color/size → negative)

Usage:
    python scripts/generate_enriched_data.py
    python scripts/generate_enriched_data.py --extra_products 400 --extra_triplets 2000
"""
from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

# ══════════════════════════════════════════════════════════════════════════════
# FASHION CATALOG — explicit attributes (color, size, gender, brand)
# ══════════════════════════════════════════════════════════════════════════════

_FASHION_TEMPLATES = [
    # (title_fn, subcategory, price_range, gender, product_type)
    # Outerwear
    ("Áo khoác bomber {gender_adj} màu {color_vi} size {size} {brand}",  "outerwear",  (200_000, 800_000)),
    ("Áo khoác dù {gender_adj} {brand} màu {color_vi} size {size}",      "outerwear",  (250_000, 900_000)),
    ("Áo hoodie {brand} oversize {color_vi} size {size}",                 "hoodie",     (150_000, 500_000)),
    ("Áo len cardigan {gender_adj} {color_vi} size {size}",               "sweater",    (120_000, 450_000)),
    ("Áo blazer {gender_adj} {color_vi} size {size}",                     "blazer",     (200_000, 700_000)),
    # Tops
    ("Áo thun {brand} {color_vi} size {size} {gender_adj}",              "t-shirt",    (80_000,  350_000)),
    ("Áo sơ mi {gender_adj} {color_vi} size {size} {brand}",             "shirt",      (100_000, 500_000)),
    # Bottoms
    ("Quần jean {gender_adj} {color_vi} size {size} {brand}",            "jeans",      (150_000, 600_000)),
    ("Quần short {gender_adj} {color_vi} size {size}",                   "shorts",     (80_000,  300_000)),
    ("Quần tây {gender_adj} {color_vi} size {size} {brand}",             "trousers",   (150_000, 600_000)),
    ("Váy {color_vi} size {size} {brand}",                                "skirt",      (100_000, 450_000)),
    ("Đầm dài {color_vi} size {size}",                                    "dress",      (150_000, 600_000)),
    # Shoes
    ("Giày thể thao {brand} {shoe_model} size {shoe_size} màu {color_vi}","sneakers",   (300_000, 2_000_000)),
    ("Giày {brand} {shoe_model} size {shoe_size}",                        "shoes",      (250_000, 1_500_000)),
    ("Giày cao gót {color_vi} size {shoe_size}",                          "heels",      (100_000, 500_000)),
    # Bags
    ("Túi xách {gender_adj} {color_vi} {brand}",                         "handbag",    (150_000, 800_000)),
    ("Ba lô {brand} {color_vi} đựng laptop {laptop_inch} inch",          "backpack",   (250_000, 1_200_000)),
    ("Ví {gender_adj} {color_vi} {brand}",                                "wallet",     (80_000,  400_000)),
]

_COLORS_VI = [
    ("đen",        "black"),
    ("trắng",      "white"),
    ("xám",        "gray"),
    ("navy",       "navy"),
    ("xanh dương", "blue"),
    ("xanh lá",    "green"),
    ("đỏ",         "red"),
    ("hồng",       "pink"),
    ("vàng",       "yellow"),
    ("cam",        "orange"),
    ("tím",        "purple"),
    ("nâu",        "brown"),
    ("be",         "beige"),
    ("kem",        "cream"),
]

_SIZES       = ["XS", "S", "M", "L", "XL", "XXL"]
_SHOE_SIZES  = ["36", "37", "38", "39", "40", "41", "42", "43"]
_GENDERS     = [("nữ", "female"), ("nam", "male"), ("unisex", "unisex")]
_GENDER_ADJ  = {"female": "nữ", "male": "nam", "unisex": ""}

_FASHION_BRANDS = [
    "Nike", "Adidas", "Uniqlo", "Zara", "H&M", "Champion", "The North Face",
    "Columbia", "Puma", "New Balance", "Converse", "Vans", "Gucci", "MLB",
    "Balenciaga", "Stussy", "", "",  # empty = no brand specified
]

_SHOE_MODELS = [
    "Air Force 1", "Air Max 90", "Stan Smith", "Ultraboost", "574",
    "Chuck Taylor", "Old Skool", "Classic Leather", "",
]

_LAPTOP_INCHES = ["13", "14", "15"]


# ══════════════════════════════════════════════════════════════════════════════
# SPORTS CATALOG
# ══════════════════════════════════════════════════════════════════════════════

_SPORTS_TEMPLATES = [
    ("Tạ tay {weight}kg cặp đôi {brand_sports}",               "weights",     (150_000, 1_200_000)),
    ("Tạ đĩa {weight}kg x{qty} cái",                           "weights",     (100_000, 500_000)),
    ("Thảm yoga {brand_yoga} dày {thick}mm màu {color_vi}",    "yoga_mat",    (100_000, 600_000)),
    ("Dây nhảy {brand_sports} cao cấp",                         "jump_rope",   (50_000,  300_000)),
    ("Vợt cầu lông {brand_badminton} {model_badminton}",       "racket",      (300_000, 2_000_000)),
    ("Vợt tennis {brand_tennis} {model_tennis}",               "racket",      (500_000, 3_000_000)),
    ("Giày thể thao {brand} chạy bộ size {shoe_size}",         "running_shoes",(300_000, 1_500_000)),
    ("Găng tay boxing {brand_sports} {size}",                   "gloves",      (100_000, 500_000)),
    ("Gậy golf {brand_golf} {golf_type}",                       "golf_club",   (500_000, 5_000_000)),
    ("Bộ tạ xà đơn đa năng {weight}kg",                        "gym_set",     (500_000, 3_000_000)),
    ("Xe đạp tập thể dục {brand_sports}",                      "exercise_bike",(1_000_000, 5_000_000)),
]

_SPORTS_BRANDS  = ["Decathlon", "Domyos", "Nike", "Adidas", "Puma", ""]
_YOGA_BRANDS    = ["Manduka", "Lululemon", "Decathlon", ""]
_BADMINTON_BR   = ["Yonex", "Victor", "Lining", "Kawasaki"]
_BADMINTON_MOD  = ["Nanoflare 800", "DriveX 9X", "3D Calibar 900", "Astrox 88D Pro"]
_TENNIS_BR      = ["Wilson", "Babolat", "Head", "Prince"]
_TENNIS_MOD     = ["Blade 98", "Pure Drive", "Radical", "Phantom"]
_GOLF_BR        = ["Callaway", "TaylorMade", "Ping", "Titleist"]
_GOLF_TYPE      = ["driver", "iron 7", "putter", "bộ 9 cây"]


# ══════════════════════════════════════════════════════════════════════════════
# CONDITIONS / DESCRIPTIONS
# ══════════════════════════════════════════════════════════════════════════════

_CONDITIONS = ["new_sealed", "like_new", "excellent", "good", "fair"]
_COND_VN = {
    "new_sealed": "mới nguyên seal",
    "like_new":   "như mới, ít dùng",
    "excellent":  "rất tốt, không xước",
    "good":       "tốt, vài vết dùng nhỏ",
    "fair":       "còn dùng được, có dấu hiệu cũ",
}

_LOCATIONS    = ["HCM", "Hanoi", "Danang", "Cantho", "Binh Duong", "Dong Nai"]

_DESCS = [
    "Mua được {months} tháng, {cond}. Còn đẹp, không lỗi. Inbox thương lượng.",
    "Lên đời bán lại, {cond}. Dùng nhẹ nhàng, giữ gìn cẩn thận. Giao toàn quốc.",
    "Đồ sinh viên thanh lý, giá mềm. Tình trạng {cond}. Cần bán gấp.",
    "Ít dùng, {cond}. Đo thấy hơi rộng nên bán lại. Có thể gặp trao đổi tại {loc}.",
    "Mua mới về không hợp, {cond}, còn tag. Giá cực hợp lý cho bạn nào cần.",
    "Hàng chính hãng, {cond}. Mua tại store chính thức, có bill. Không fix giá.",
]


def _desc(condition: str, location: str) -> str:
    t = random.choice(_DESCS)
    return (t.replace("{months}", str(random.randint(1, 24)))
             .replace("{cond}", _COND_VN[condition])
             .replace("{loc}", location))


# ══════════════════════════════════════════════════════════════════════════════
# CATALOG GENERATION
# ══════════════════════════════════════════════════════════════════════════════

def _fill(s: str, **kw) -> str:
    for k, v in kw.items():
        s = s.replace("{" + k + "}", v)
    return s.replace("  ", " ").strip()


def _make_fashion_product(pid: str) -> dict:
    tmpl, subcat, price_range = random.choice(_FASHION_TEMPLATES)
    color_vi, color_en = random.choice(_COLORS_VI)
    size               = random.choice(_SIZES)
    shoe_size          = random.choice(_SHOE_SIZES)
    gender_vi, gen_en  = random.choice(_GENDERS)
    brand              = random.choice(_FASHION_BRANDS)
    gender_adj         = _GENDER_ADJ[gen_en]
    condition          = random.choice(_CONDITIONS)
    location           = random.choice(_LOCATIONS)
    price              = random.randint(*price_range) // 10_000 * 10_000

    title = _fill(tmpl,
        color_vi=color_vi, size=size, shoe_size=shoe_size,
        gender_adj=gender_adj, brand=brand,
        shoe_model=random.choice(_SHOE_MODELS),
        laptop_inch=random.choice(_LAPTOP_INCHES),
    )

    return {
        "product_id":  pid,
        "title":       title,
        "description": _desc(condition, location),
        "category":    "fashion",
        "subcategory": subcat,
        "price":       price,
        "condition":   condition,
        "location":    location,
        "seller_id":   f"s{random.randint(1, 200):03d}",
        "image_path":  None,
        "image_url":   None,
        "_meta": {          # for triplet generation — stripped before saving
            "color":    color_en,
            "size":     size,
            "gender":   gen_en,
            "brand":    brand.lower() if brand else None,
        },
    }


def _make_sports_product(pid: str) -> dict:
    tmpl, subcat, price_range = random.choice(_SPORTS_TEMPLATES)
    color_vi, color_en = random.choice(_COLORS_VI)
    condition          = random.choice(_CONDITIONS)
    location           = random.choice(_LOCATIONS)
    price              = random.randint(*price_range) // 10_000 * 10_000

    title = _fill(tmpl,
        weight=str(random.choice([5, 8, 10, 15, 20])),
        qty=str(random.choice([2, 4])),
        thick=str(random.choice([6, 8, 10])),
        color_vi=color_vi, size=random.choice(_SIZES),
        shoe_size=random.choice(_SHOE_SIZES),
        brand=random.choice(_FASHION_BRANDS),
        brand_sports=random.choice(_SPORTS_BRANDS),
        brand_yoga=random.choice(_YOGA_BRANDS),
        brand_badminton=random.choice(_BADMINTON_BR),
        model_badminton=random.choice(_BADMINTON_MOD),
        brand_tennis=random.choice(_TENNIS_BR),
        model_tennis=random.choice(_TENNIS_MOD),
        brand_golf=random.choice(_GOLF_BR),
        golf_type=random.choice(_GOLF_TYPE),
    )

    return {
        "product_id":  pid,
        "title":       title,
        "description": _desc(condition, location),
        "category":    "sports",
        "subcategory": subcat,
        "price":       price,
        "condition":   condition,
        "location":    location,
        "seller_id":   f"s{random.randint(1, 200):03d}",
        "image_path":  None,
        "image_url":   None,
    }


def generate_extra_catalog(
    existing_path: Path,
    n_fashion:     int = 200,
    n_sports:      int = 150,
    n_books:       int = 50,
) -> list[dict]:
    """Append new products to existing catalog and return all products."""

    # Load existing
    existing: list[dict] = []
    if existing_path.exists():
        with open(existing_path) as f:
            for line in f:
                existing.append(json.loads(line))

    max_pid = 0
    for p in existing:
        try:
            max_pid = max(max_pid, int(p["product_id"][1:]))
        except (ValueError, IndexError):
            pass

    new_products: list[dict] = []
    counter = max_pid + 1

    # Fashion
    for _ in range(n_fashion):
        p = _make_fashion_product(f"p{counter:04d}")
        new_products.append(p)
        counter += 1

    # Sports
    for _ in range(n_sports):
        p = _make_sports_product(f"p{counter:04d}")
        new_products.append(p)
        counter += 1

    # Books (reuse existing template style)
    _BOOK_SUBJECTS = [
        "Toán rời rạc", "Cơ sở dữ liệu", "Mạng máy tính", "Trí tuệ nhân tạo",
        "Kỹ thuật phần mềm", "Kinh tế lượng", "Tài chính doanh nghiệp",
        "Marketing số", "Quản trị chiến lược", "Luật thương mại",
    ]
    _BOOK_UNIS = ["UET", "NEU", "HCMUT", "UEH", "VNU", "FTU", "RMIT"]
    for _ in range(n_books):
        condition = random.choice(_CONDITIONS)
        location  = random.choice(_LOCATIONS)
        subject   = random.choice(_BOOK_SUBJECTS)
        uni       = random.choice(_BOOK_UNIS)
        vol       = random.choice(["1", "2"])
        price     = random.randint(30_000, 200_000) // 5_000 * 5_000

        new_products.append({
            "product_id":  f"p{counter:04d}",
            "title":       f"Giáo trình {subject} {uni} tập {vol}",
            "description": _desc(condition, location),
            "category":    "books",
            "subcategory": "textbook",
            "price":       price,
            "condition":   condition,
            "location":    location,
            "seller_id":   f"s{random.randint(1, 200):03d}",
            "image_path":  None,
            "image_url":   None,
        })
        counter += 1

    # Save (strip _meta before writing)
    all_products = existing + new_products
    with open(existing_path, "w", encoding="utf-8") as f:
        for p in all_products:
            clean = {k: v for k, v in p.items() if k != "_meta"}
            f.write(json.dumps(clean, ensure_ascii=False) + "\n")

    print(f"✓ Catalog updated: {len(existing)} + {len(new_products)} = {len(all_products)} products")
    return all_products, new_products


# ══════════════════════════════════════════════════════════════════════════════
# PARSER TRAINING DATA — complex queries
# ══════════════════════════════════════════════════════════════════════════════

_PRICE_PHRASES = [
    "dưới {max}k", "tầm {max}k", "budget {max}k", "không quá {max}k",
    "giá {max}k", "tối đa {max}k",
    "dưới {max} triệu", "tầm {max} triệu", "budget {max} triệu",
    "{min}k - {max}k",  "{min} triệu đến {max} triệu",
]

_CONDITION_PHRASES = {
    "hard": [
        "còn mới", "như mới", "nguyên seal", "ít dùng", "không xước",
        "tình trạng tốt", "like new",
    ],
    "soft": [
        "đẹp", "tốt", "còn dùng được", "đã qua sử dụng", "cũ nhưng oke",
    ],
}

_QUERY_TEMPLATES = [
    # Category only
    "Cần tìm {product} {gender_vn}",
    "Ai có {product} {gender_vn} bán không",
    "Tìm {product} {gender_vn} giá sinh viên",

    # Category + color
    "Tìm {product} {gender_vn} màu {color_vi}",
    "Cần {product} màu {color_vi} {gender_vn}",
    "Ai có {product} {color_vi} {gender_vn} bán không",

    # Category + color + size
    "Tìm {product} {gender_vn} màu {color_vi} size {size}",
    "Cần {product} màu {color_vi} size {size}",
    "Ai có {product} {color_vi} size {size} {gender_vn}",
    "Tìm {product} size {size} màu {color_vi}",

    # Category + brand
    "Tìm {product} {brand} {gender_vn}",
    "Cần {product} {brand} còn tốt",
    "Ai có {product} {brand} bán lại không",

    # Category + brand + color + size
    "Tìm {product} {brand} màu {color_vi} size {size}",
    "Cần {product} {brand} {color_vi} size {size} {gender_vn}",
    "Ai bán {product} {brand} {color_vi} size {size}",

    # Category + price
    "Tìm {product} {gender_vn} {price}",
    "Cần {product} {price}, {gender_vn}",
    "Ai có {product} giá {price} bán không",

    # Category + color + price
    "Tìm {product} màu {color_vi} {price}",
    "Cần {product} {color_vi} {price}, {gender_vn}",

    # Category + size + price
    "Tìm {product} size {size} {price}",
    "Cần {product} size {size} {price} {gender_vn}",

    # Full combo: category + brand + color + size + price
    "Tìm {product} {brand} màu {color_vi} size {size} {price}",
    "Cần {product} {brand} {color_vi} size {size} {price} {gender_vn}",
    "Ai có {product} {brand} {color_vi} size {size} {price}",

    # Full combo + condition
    "Tìm {product} {brand} {color_vi} size {size} {price} {condition}",
    "Cần {product} {gender_vn} {color_vi} size {size} {price} {condition}",
    "Tìm {product} {brand} size {size} {price} {condition}",

    # Natural language
    "Mình đang tìm {product} {gender_vn} màu {color_vi} size {size}, budget {price}",
    "Cần mua gấp {product} {brand} {color_vi} size {size}",
    "Cho mình hỏi ai đang bán {product} {brand} màu {color_vi} không ạ",
    "Sinh viên cần {product} {gender_vn} giá mềm, màu {color_vi} ok hết",
    "Pass lại {product} {brand} size {size} màu {color_vi} {condition}",
]

_PRODUCT_NAMES = {
    "fashion": [
        ("áo khoác", "fashion"), ("áo hoodie", "fashion"), ("áo thun", "fashion"),
        ("áo sơ mi", "fashion"), ("quần jean", "fashion"), ("quần short", "fashion"),
        ("váy", "fashion"), ("đầm", "fashion"), ("giày thể thao", "fashion"),
        ("ba lô", "fashion"), ("túi xách", "fashion"), ("ví", "fashion"),
        ("áo len", "fashion"), ("áo blazer", "fashion"),
    ],
    "electronics": [
        ("laptop", "electronics"), ("điện thoại", "electronics"),
        ("tai nghe", "electronics"), ("iphone", "electronics"),
        ("macbook", "electronics"), ("samsung", "electronics"),
    ],
    "sports": [
        ("tạ tay", "sports"), ("thảm yoga", "sports"),
        ("vợt cầu lông", "sports"), ("giày chạy bộ", "sports"),
    ],
}


def _random_price_phrase() -> str:
    t   = random.choice(_PRICE_PHRASES)
    mn  = random.randint(1, 10) * 100
    mx  = random.randint(mn + 100, mn + 800)
    if "{min}" in t and "{max}" in t:
        # range
        if "triệu" in t:
            mn_tr = random.randint(1, 5)
            mx_tr = mn_tr + random.randint(1, 3)
            return t.replace("{min}", str(mn_tr)).replace("{max}", str(mx_tr))
        return t.replace("{min}", str(mn)).replace("{max}", str(mx))
    if "triệu" in t:
        val = random.randint(1, 10)
        return t.replace("{max}", str(val))
    return t.replace("{max}", str(mx))


def generate_parser_queries(
    out_path: Path,
    n_queries: int = 3000,
    val_ratio: float = 0.15,
) -> None:
    """Generate parser training queries with category labels."""
    all_queries: list[dict] = []

    for _ in range(n_queries):
        cat = random.choice(list(_PRODUCT_NAMES.keys()))
        product_name, category = random.choice(_PRODUCT_NAMES[cat])

        color_vi, _  = random.choice(_COLORS_VI)
        size         = random.choice(_SIZES)
        gender_vi, _ = random.choice(_GENDERS)
        brand        = random.choice([b for b in _FASHION_BRANDS if b])
        price_phrase = _random_price_phrase()
        cond_type    = random.choice(["hard", "soft", "none"])
        condition    = ""
        if cond_type != "none":
            condition = random.choice(_CONDITION_PHRASES[cond_type])

        template = random.choice(_QUERY_TEMPLATES)
        query = (template
                 .replace("{product}",    product_name)
                 .replace("{gender_vn}",  gender_vi)
                 .replace("{color_vi}",   color_vi)
                 .replace("{size}",       size)
                 .replace("{brand}",      brand)
                 .replace("{price}",      price_phrase)
                 .replace("{condition}",  condition)
                 .strip())

        # Remove double spaces
        while "  " in query:
            query = query.replace("  ", " ")

        all_queries.append({
            "query":    query,
            "category": category,
        })

    random.shuffle(all_queries)
    split = int(len(all_queries) * (1 - val_ratio))

    train_path = out_path.parent / "parser_train.jsonl"
    val_path   = out_path.parent / "parser_val.jsonl"

    # Append to existing
    for path, data in [(train_path, all_queries[:split]), (val_path, all_queries[split:])]:
        with open(path, "a", encoding="utf-8") as f:
            for q in data:
                f.write(json.dumps(q, ensure_ascii=False) + "\n")

    print(f"✓ Added {split} parser train queries → {train_path}")
    print(f"✓ Added {len(all_queries) - split} parser val queries → {val_path}")


# ══════════════════════════════════════════════════════════════════════════════
# ATTRIBUTE-SENSITIVE TRIPLETS
# ══════════════════════════════════════════════════════════════════════════════

def _build_attribute_negative(
    positive: dict,
    all_new:  list[dict],
) -> dict | None:
    """
    Find a negative that has the same product type but different attributes.
    Preferred: same subcategory, different color OR size OR brand.
    """
    pos_meta  = positive.get("_meta", {})
    pos_subcat = positive.get("subcategory", "")

    candidates = [
        p for p in all_new
        if p.get("subcategory") == pos_subcat
        and p.get("product_id") != positive["product_id"]
    ]
    if not candidates:
        return None

    # Pick one with at least one attribute difference
    pos_color = pos_meta.get("color")
    pos_size  = pos_meta.get("size")
    pos_brand = pos_meta.get("brand")

    for neg in random.sample(candidates, min(len(candidates), 10)):
        neg_meta = neg.get("_meta", {})
        if (neg_meta.get("color") != pos_color or
            neg_meta.get("size")  != pos_size  or
            neg_meta.get("brand") != pos_brand):
            return neg

    return random.choice(candidates)


def generate_attribute_triplets(
    new_products:   list[dict],
    out_train_path: Path,
    out_val_path:   Path,
    n_triplets:     int = 2000,
    val_ratio:      float = 0.15,
) -> None:
    """
    Generate triplets testing attribute matching.

    Query = built from positive product's attributes (color + size + gender + brand).
    Positive = product matching all attributes.
    Negative = same subcategory, different attributes.
    """
    fashion_products = [p for p in new_products if p["category"] == "fashion" and "_meta" in p]
    if not fashion_products:
        print("No fashion products with _meta found, skipping attribute triplets")
        return

    # Load existing triplet IDs to continue numbering
    existing_count = 0
    for path in [out_train_path, out_val_path]:
        if path.exists():
            with open(path) as f:
                existing_count += sum(1 for _ in f)

    triplets: list[dict] = []
    attempts = 0
    while len(triplets) < n_triplets and attempts < n_triplets * 5:
        attempts += 1
        pos = random.choice(fashion_products)
        neg = _build_attribute_negative(pos, fashion_products)
        if neg is None:
            continue

        meta  = pos.get("_meta", {})
        color_vi = next((vi for vi, en in _COLORS_VI if en == meta.get("color")), "")
        size     = meta.get("size", "M")
        gender_vi = next((vi for vi, en in _GENDERS if en == meta.get("gender")), "")
        brand    = meta.get("brand") or ""
        subcat   = pos.get("subcategory", "áo khoác")

        # Build query reflecting positive's attributes
        parts = [subcat]
        if gender_vi:
            parts.append(gender_vi)
        if color_vi:
            parts.append(f"màu {color_vi}")
        if size:
            parts.append(f"size {size}")
        if brand:
            parts.append(brand)

        # Randomly add price / condition
        if random.random() < 0.4:
            price = pos.get("price", 0)
            budget = price * random.uniform(1.1, 1.5)
            if budget >= 1_000_000:
                parts.append(f"dưới {int(budget/1_000_000)} triệu")
            else:
                parts.append(f"dưới {int(budget/1_000)}k")

        if random.random() < 0.3:
            parts.append(random.choice(_CONDITION_PHRASES["hard"]))

        query = " ".join(parts)
        query_id = f"qa{existing_count + len(triplets) + 1:05d}"

        triplets.append({
            "query_id":            query_id,
            "query":               query,
            "positive_product_id": pos["product_id"],
            "negative_product_id": neg["product_id"],
            "positive_score":      1.0,
            "negative_score":      0.0,
        })

    random.shuffle(triplets)
    split = int(len(triplets) * (1 - val_ratio))

    for path, data in [(out_train_path, triplets[:split]), (out_val_path, triplets[split:])]:
        with open(path, "a", encoding="utf-8") as f:
            for t in data:
                f.write(json.dumps(t, ensure_ascii=False) + "\n")

    print(f"✓ Added {split} attribute-sensitive train triplets → {out_train_path}")
    print(f"✓ Added {len(triplets) - split} attribute-sensitive val triplets → {out_val_path}")


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--extra_products",     type=int, default=400)
    ap.add_argument("--extra_parser_queries", type=int, default=3000)
    ap.add_argument("--extra_triplets",     type=int, default=2000)
    ap.add_argument("--seed",               type=int, default=99)
    args = ap.parse_args()

    random.seed(args.seed)

    data_dir = Path("data/processed")
    data_dir.mkdir(parents=True, exist_ok=True)

    n_fashion = int(args.extra_products * 0.55)   # 55% fashion (thinnest)
    n_sports  = int(args.extra_products * 0.35)   # 35% sports
    n_books   = args.extra_products - n_fashion - n_sports

    # 1. Extend catalog
    print("\n── Step 1: Extend catalog ──")
    all_products, new_products = generate_extra_catalog(
        data_dir / "catalog.jsonl",
        n_fashion=n_fashion,
        n_sports=n_sports,
        n_books=n_books,
    )

    # 2. More parser queries
    print("\n── Step 2: Parser training queries ──")
    generate_parser_queries(
        data_dir / "parser_train.jsonl",
        n_queries=args.extra_parser_queries,
    )

    # 3. Attribute-sensitive triplets
    print("\n── Step 3: Attribute-sensitive triplets ──")
    generate_attribute_triplets(
        new_products,
        out_train_path = data_dir / "train.jsonl",
        out_val_path   = data_dir / "val.jsonl",
        n_triplets     = args.extra_triplets,
    )

    # Summary
    print("\n── Summary ──")
    for f in sorted(data_dir.glob("*.jsonl")):
        lines = sum(1 for _ in open(f))
        print(f"  {f.name}: {lines:,} records")

    print("\n✓ Done. Next:")
    print("  python scripts/build_index.py")
    print("  python scripts/train_pipeline.py --model biencoder")


if __name__ == "__main__":
    main()
