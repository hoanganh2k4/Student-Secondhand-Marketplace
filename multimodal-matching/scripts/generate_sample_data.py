"""
scripts/generate_sample_data.py
Generate synthetic catalog + triplet data for the Student Secondhand Marketplace.

Usage:
    python scripts/generate_sample_data.py --n_products 500 --n_triplets 1000
"""
from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

# ── Product Templates ─────────────────────────────────────────────────────────
# (title_template, category, subcategory, price_range_vnd)

PRODUCTS = [
    # Electronics – Phones
    ("iPhone {iphone_model} {storage}GB màu {color_vn}", "electronics", "smartphone", (8_000_000, 25_000_000)),
    ("Samsung Galaxy {samsung_model} {storage}GB", "electronics", "smartphone", (4_000_000, 18_000_000)),
    ("Xiaomi {xiaomi_model} {storage}GB RAM {ram}GB", "electronics", "smartphone", (3_000_000, 10_000_000)),
    ("OPPO {oppo_model} {storage}GB", "electronics", "smartphone", (3_500_000, 9_000_000)),

    # Electronics – Laptops
    ("MacBook {macbook_model} {macbook_year} {ram}GB RAM {ssd}GB SSD", "electronics", "laptop", (12_000_000, 35_000_000)),
    ("Dell {dell_model} i{cpu_gen} RAM {ram}GB SSD {ssd}GB", "electronics", "laptop", (6_000_000, 22_000_000)),
    ("Asus {asus_model} RAM {ram}GB SSD {ssd}GB", "electronics", "laptop", (7_000_000, 20_000_000)),
    ("Lenovo ThinkPad {thinkpad_model} RAM {ram}GB", "electronics", "laptop", (6_000_000, 18_000_000)),

    # Electronics – Audio / Accessories
    ("AirPods {airpods_model}", "electronics", "audio", (1_200_000, 4_500_000)),
    ("Tai nghe Sony {sony_headphone} không dây", "electronics", "audio", (800_000, 5_000_000)),
    ("Chuột {mouse_brand} {mouse_model} không dây", "electronics", "peripherals", (300_000, 2_500_000)),
    ("Bàn phím cơ {kb_brand} {kb_model} switch {switch}", "electronics", "peripherals", (600_000, 4_000_000)),

    # Electronics – Tablets
    ("iPad {ipad_model} {ipad_storage}GB wifi", "electronics", "tablet", (6_000_000, 18_000_000)),
    ("Samsung Tab {tab_model} {ipad_storage}GB", "electronics", "tablet", (4_000_000, 12_000_000)),

    # Books – Textbooks
    ("Giáo trình {subject} {uni} tập {book_vol}", "books", "textbook", (30_000, 150_000)),
    ("Sách bài tập {subject} có đáp án", "books", "textbook", (25_000, 100_000)),
    ("Tài liệu ôn thi {exam_name} {year}", "books", "exam_prep", (50_000, 200_000)),
    ("{author} - {book_title} (bản {edition} edition)", "books", "reference", (80_000, 350_000)),

    # Vehicles – Bikes & Motorbikes
    ("Xe đạp {bike_brand} {bike_type} size {bike_size}", "vehicles", "bicycle", (1_500_000, 8_000_000)),
    ("Xe máy Honda {moto_model} {moto_year} biển {plate_city}", "vehicles", "motorbike", (8_000_000, 35_000_000)),
    ("Xe máy Yamaha {yamaha_model} {moto_year}", "vehicles", "motorbike", (9_000_000, 32_000_000)),
    ("Xe đạp điện {ebike_brand} pin {battery_km}km", "vehicles", "e_bicycle", (3_000_000, 12_000_000)),

    # Dorm & Furniture
    ("Quạt điện {fan_brand} {fan_type} {fan_speed} tốc độ", "furniture", "dorm", (200_000, 1_200_000)),
    ("Nồi cơm điện {rice_brand} {rice_liter}L", "furniture", "dorm", (300_000, 1_500_000)),
    ("Đèn học {lamp_brand} chống mỏi mắt", "furniture", "dorm", (150_000, 800_000)),
    ("Giá sách gỗ {shelf_size} tầng", "furniture", "storage", (400_000, 2_000_000)),
    ("Bàn học gấp gọn rộng {desk_width}cm", "furniture", "desk", (300_000, 1_800_000)),

    # Fashion
    ("Áo thun {brand_fashion} oversize màu {color_vn}", "fashion", "tops", (80_000, 400_000)),
    ("Quần jean {brand_fashion} {jean_type} size {clothing_size}", "fashion", "bottoms", (150_000, 700_000)),
    ("Giày {shoe_brand} {shoe_model} size {shoe_size}", "fashion", "shoes", (300_000, 2_500_000)),
    ("Áo khoác {jacket_brand} {jacket_type} màu {color_vn}", "fashion", "outerwear", (300_000, 1_500_000)),
    ("Ba lô {bag_brand} đựng laptop {laptop_inch} inch", "fashion", "bags", (250_000, 1_200_000)),

    # Sports & Fitness
    ("Tạ tay {dumbbell_weight}kg cặp đôi", "sports", "fitness", (200_000, 1_500_000)),
    ("Thảm yoga {yoga_brand} dày {yoga_thick}mm", "sports", "fitness", (150_000, 800_000)),
    ("Vợt cầu lông {badminton_brand} {badminton_model}", "sports", "badminton", (300_000, 2_000_000)),
]

FILLS = {
    # Phones
    "iphone_model":     ["12", "12 Pro", "13", "13 Pro", "14", "14 Plus", "14 Pro", "15"],
    "samsung_model":    ["A54", "A53", "S22", "S23", "S23+", "S23 Ultra", "A34"],
    "xiaomi_model":     ["Redmi Note 12", "Redmi Note 11", "POCO X5", "Xiaomi 13T"],
    "oppo_model":       ["A78", "A58", "Reno 8", "Reno 10", "Find X6"],
    "storage":          ["64", "128", "256", "512"],
    "ram":              ["6", "8", "12", "16", "32"],
    "color_vn":         ["đen", "trắng", "xanh dương", "tím", "đỏ", "hồng", "vàng", "xanh lá"],

    # Laptops
    "macbook_model":    ["Air M1", "Air M2", "Pro M1", "Pro M2", "Pro 14 M3"],
    "macbook_year":     ["2020", "2021", "2022", "2023"],
    "dell_model":       ["XPS 13", "XPS 15", "Inspiron 15", "Latitude 5520"],
    "asus_model":       ["ZenBook 14", "VivoBook 15", "ROG Zephyrus G14", "TUF Gaming F15"],
    "thinkpad_model":   ["E14", "X1 Carbon", "T14s", "L15"],
    "cpu_gen":          ["5", "7", "9", "11", "12"],
    "ssd":              ["256", "512", "1000"],

    # Audio
    "airpods_model":    ["2nd Gen", "3rd Gen", "Pro 1st Gen", "Pro 2nd Gen", "Max"],
    "sony_headphone":   ["WH-1000XM4", "WH-1000XM5", "WF-1000XM4", "WH-CH720N"],
    "mouse_brand":      ["Logitech", "Razer", "Asus", "MSI"],
    "mouse_model":      ["MX Master 3", "G305", "DeathAdder V3", "ROG Strix"],
    "kb_brand":         ["Keychron", "Leopold", "Ducky", "AKKO"],
    "kb_model":         ["K2 Pro", "FC750R", "One 3", "3098B"],
    "switch":           ["Red", "Brown", "Blue", "Black", "Silent Red"],

    # Tablets
    "ipad_model":       ["Air 5", "Air 4", "Pro 11 M2", "Pro 12.9 M2", "Mini 6", "10th Gen"],
    "tab_model":        ["S8", "S8+", "S9", "A9+"],
    "ipad_storage":     ["64", "128", "256", "512"],

    # Books
    "subject":          ["Giải tích", "Đại số tuyến tính", "Vật lý", "Hóa đại cương", "Lập trình C", "CTDL & GT", "Kinh tế vi mô", "Marketing căn bản", "Kế toán tài chính", "Luật dân sự"],
    "uni":              ["UET", "NEU", "BUH", "HCMUT", "UEH", "VNU", "RMIT", "FTU"],
    "book_vol":         ["1", "2", "3"],
    "exam_name":        ["TOEIC", "IELTS", "CPA", "CFA Level 1", "PMP", "AWS"],
    "year":             ["2022", "2023", "2024"],
    "author":           ["Robert Kiyosaki", "Dale Carnegie", "Malcolm Gladwell", "Cal Newport", "James Clear"],
    "book_title":       ["Atomic Habits", "Deep Work", "Thinking Fast and Slow", "Rich Dad Poor Dad", "How to Win Friends"],
    "edition":          ["2nd", "3rd", "4th", "5th"],

    # Vehicles
    "bike_brand":       ["Giant", "Trek", "Asama", "Jett", "Twitter"],
    "bike_type":        ["thể thao", "touring", "gấp", "địa hình MTB"],
    "bike_size":        ["S", "M", "L", "XL", "26 inch", "27.5 inch"],
    "moto_model":       ["Wave Alpha", "Wave RSX", "Air Blade", "Vision", "Lead", "Vario"],
    "yamaha_model":     ["Exciter 155", "NVX 155", "Grande", "Janus", "FreeGo"],
    "moto_year":        ["2018", "2019", "2020", "2021", "2022", "2023"],
    "plate_city":       ["Hà Nội", "HCM", "Đà Nẵng", "Bình Dương"],
    "ebike_brand":      ["DTP", "VinFast", "Bridgestone", "Yadea"],
    "battery_km":       ["50", "60", "70", "80"],

    # Dorm
    "fan_brand":        ["Panasonic", "Sunhouse", "Midea", "Asia"],
    "fan_type":         ["đứng", "treo tường", "để bàn", "hút ẩm"],
    "fan_speed":        ["3", "4", "5"],
    "rice_brand":       ["Cuckoo", "Panasonic", "Sunhouse", "Toshiba"],
    "rice_liter":       ["1", "1.5", "1.8"],
    "lamp_brand":       ["Philips", "Panasonic", "Wipro", "Rạng Đông"],
    "shelf_size":       ["3", "4", "5", "6"],
    "desk_width":       ["80", "100", "120"],

    # Fashion
    "brand_fashion":    ["Uniqlo", "Zara", "H&M", "Local Brand", "MLB", "Champion"],
    "jean_type":        ["skinny", "slim fit", "straight", "ripped", "wide leg"],
    "clothing_size":    ["XS", "S", "M", "L", "XL", "XXL"],
    "shoe_brand":       ["Nike", "Adidas", "New Balance", "Converse", "Vans", "On Cloud"],
    "shoe_model":       ["Air Force 1", "Stan Smith", "574", "Chuck Taylor", "Old Skool", "Cloudmonster"],
    "shoe_size":        ["37", "38", "39", "40", "41", "42", "43", "44"],
    "jacket_brand":     ["Uniqlo", "The North Face", "Columbia", "Patagonia"],
    "jacket_type":      ["lông vũ", "nỉ", "dù", "da"],
    "bag_brand":        ["Samsonite", "Targus", "JanSport", "Herschel", "Tumi"],
    "laptop_inch":      ["13", "14", "15", "15.6"],

    # Sports
    "dumbbell_weight":  ["5", "10", "15", "20"],
    "yoga_brand":       ["Manduka", "Lululemon", "Decathlon"],
    "yoga_thick":       ["6", "8", "10"],
    "badminton_brand":  ["Yonex", "Victor", "Lining", "Kawasaki"],
    "badminton_model":  ["Nanoflare 700", "DriveX 09B", "3D Calibar 900", "Astrox 88D"],
}

CONDITIONS = ["new_sealed", "like_new", "excellent", "good", "fair"]
CONDITION_VN = {
    "new_sealed": "mới nguyên seal",
    "like_new":   "như mới, ít dùng",
    "excellent":  "rất tốt, không trầy xước",
    "good":       "tốt, vài vết sử dụng nhỏ",
    "fair":       "còn dùng được, có dấu hiệu dùng lâu",
}

LOCATIONS = ["HCM", "Hanoi", "Danang", "Cantho", "Binh Duong", "Dong Nai"]

DESCRIPTION_TEMPLATES = [
    "Mua được {months} tháng, dùng nhẹ nhàng, tình trạng {condition_vn}. Full box, đủ phụ kiện gốc. Không fix giá, ib thương lượng.",
    "Cần bán gấp do chuyển trường, {condition_vn}. Máy hoạt động tốt 100%, không lỗi lầm gì. Giá fix, nghiêm túc mới nhắn.",
    "Dùng được {months} tháng, pin còn {battery}%, {condition_vn}. Tặng kèm {accessory}. Gặp trực tiếp trao đổi tại {location}.",
    "Lên đời nên bán, hàng chính hãng, {condition_vn}. Bảo hành hãng còn {warranty} tháng. Giá {discount}% so với mua mới.",
    "Mua mới không dùng nhiều, tình trạng {condition_vn}. Đã test kỹ, hoạt động ổn định. Giao hàng toàn quốc hoặc gặp trực tiếp.",
    "Đồ sinh viên dùng, giá mềm cho bạn nào cần. Tình trạng {condition_vn}, dùng được {months} tháng. Không bao gồm phụ kiện.",
]

BUYER_QUERIES = [
    # Direct title-based (easy)
    "Tìm mua {title}",
    "Cần {title} giá sinh viên",
    "Ai có {title} bán không, cần gấp",
    "Muốn mua lại {title} cũ còn tốt",
    "{title} cũ cho sinh viên",
    "Looking for {title} good condition",

    # Natural language intent (harder — teaches model to handle real queries)
    "Tôi muốn mua {title}, tình trạng đẹp",
    "Bạn nào có {title} cũ muốn thanh lý không?",
    "Mình đang tìm {title} giá hợp lý cho sinh viên",
    "Cần tìm {title} second hand còn dùng tốt, giá mềm",
    "Cho hỏi ai đang bán {title} không ạ, mình cần gấp",
    "Tìm {title} tình trạng từ tốt trở lên, thương lượng giá",
    "Sinh viên cần mua {title}, ưu tiên giá rẻ",
    "Mình muốn mua {title} cũ, không cần mới, miễn còn dùng được",
    "Có ai bán {title} không? Mình đang cần dùng gấp",
    "Tìm mua lại {title}, giá thỏa thuận",

    # Partial / vague (teaches semantic understanding)
    "Cần mua đồ điện tử cũ còn tốt",
    "Tìm sách giáo trình đại học thanh lý",
    "Ai bán xe cũ giá sinh viên không",
    "Cần đồ dùng phòng trọ giá rẻ",
    "Tìm quần áo secondhand còn mới",
]


def fill_template(template: str) -> str:
    result = template
    for key, choices in FILLS.items():
        placeholder = "{" + key + "}"
        if placeholder in result:
            result = result.replace(placeholder, random.choice(choices))
    return result


def build_description(condition: str, location: str) -> str:
    tmpl = random.choice(DESCRIPTION_TEMPLATES)
    months   = random.randint(1, 30)
    battery  = random.randint(75, 100)
    warranty = random.randint(0, 12)
    discount = random.randint(20, 50)
    accessories = ["ốp lưng", "cáp sạc dự phòng", "túi đựng", "miếng dán màn hình", "bao da"]
    return (tmpl
            .replace("{months}", str(months))
            .replace("{battery}", str(battery))
            .replace("{warranty}", str(warranty))
            .replace("{discount}", str(discount))
            .replace("{condition_vn}", CONDITION_VN[condition])
            .replace("{accessory}", random.choice(accessories))
            .replace("{location}", location))


def generate_catalog(n: int, out_path: Path) -> list[dict]:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    products = []

    for i in range(n):
        tmpl, category, subcategory, price_range = random.choice(PRODUCTS)
        title     = fill_template(tmpl)
        condition = random.choice(CONDITIONS)
        location  = random.choice(LOCATIONS)
        price     = random.randint(*price_range) // 10_000 * 10_000

        product = {
            "product_id":   f"p{i+1:04d}",
            "title":        title,
            "description":  build_description(condition, location),
            "category":     category,
            "subcategory":  subcategory,
            "price":        price,
            "condition":    condition,
            "location":     location,
            "seller_id":    f"s{random.randint(1, 100):03d}",
            "image_path":   None,
            "image_url":    None,
        }
        products.append(product)

    with open(out_path, "w", encoding="utf-8") as f:
        for p in products:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")

    print(f"✓ Wrote {len(products)} products to {out_path}")
    return products


def _hard_negative(product: dict, all_products: list[dict]) -> dict:
    """
    Negative sampling strategy (by priority):
    1. Same subcategory, different product        → hardest
    2. Same category, different subcategory       → medium
    3. Random different category                  → easiest
    """
    pid   = product["product_id"]
    subcat = product["subcategory"]
    cat    = product["category"]

    same_sub = [p for p in all_products if p["subcategory"] == subcat and p["product_id"] != pid]
    if len(same_sub) >= 2:
        return random.choice(same_sub)

    same_cat = [p for p in all_products if p["category"] == cat and p["product_id"] != pid]
    if same_cat:
        return random.choice(same_cat)

    return random.choice([p for p in all_products if p["product_id"] != pid])


def generate_triplets(products: list[dict], n: int, out_path: Path, val_ratio: float = 0.15):
    out_path.parent.mkdir(parents=True, exist_ok=True)
    triplets = []

    for i in range(n):
        pos = random.choice(products)
        neg = _hard_negative(pos, products)

        query_tmpl = random.choice(BUYER_QUERIES)
        query = query_tmpl.replace("{title}", pos["title"])

        triplets.append({
            "query_id":            f"q{i+1:05d}",
            "query":               query,
            "positive_product_id": pos["product_id"],
            "negative_product_id": neg["product_id"],
            "positive_score":      1.0,
            "negative_score":      0.0,
        })

    random.shuffle(triplets)
    split = int(len(triplets) * (1 - val_ratio))

    train_path = out_path.parent / "train.jsonl"
    val_path   = out_path.parent / "val.jsonl"

    for path, data in [(train_path, triplets[:split]), (val_path, triplets[split:])]:
        with open(path, "w", encoding="utf-8") as f:
            for t in data:
                f.write(json.dumps(t, ensure_ascii=False) + "\n")

    print(f"✓ Wrote {split} train triplets to {train_path}")
    print(f"✓ Wrote {len(triplets) - split} val triplets to {val_path}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--n_products", type=int, default=500)
    parser.add_argument("--n_triplets", type=int, default=1500)
    parser.add_argument("--seed",       type=int, default=42)
    args = parser.parse_args()

    random.seed(args.seed)

    catalog_path = Path("data/processed/catalog.jsonl")
    triplet_path = Path("data/processed/triplets.jsonl")

    products = generate_catalog(args.n_products, catalog_path)
    generate_triplets(products, args.n_triplets, triplet_path)

    # Print a few samples
    print("\n--- Sample products ---")
    for p in random.sample(products, min(3, len(products))):
        print(f"  [{p['category']}/{p['subcategory']}] {p['title']} — {p['price']:,}đ")

    print("\nDone! Next:")
    print("  python scripts/build_index.py")
    print("  python scripts/train.py --model biencoder")
    print("  python scripts/evaluate.py")
    print("  uvicorn api.main:app --port 8000")


if __name__ == "__main__":
    main()
