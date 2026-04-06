"""
scripts/generate_large_dataset.py
Generate large-scale training data for deep BiEncoder training (10+ epochs).

Tạo ra:
  1. ~3000 sản phẩm mới → tổng ~4000 products
  2. ~20,000 triplets với 4 loại hard negative:
       L1 — khác category hoàn toàn           (easy negative)
       L2 — cùng category, khác subcategory   (medium negative)
       L3 — cùng subcategory, khác brand/attr (hard negative)
       L4 — cùng subcategory + brand, khác color/size  (very hard)
  3. ~10,000 parser queries đa dạng hơn

Usage:
    python scripts/generate_large_dataset.py
    python scripts/generate_large_dataset.py --n_products 3000 --n_triplets 20000
"""
from __future__ import annotations

import argparse
import json
import random
from pathlib import Path
from itertools import product as iproduct

# ══════════════════════════════════════════════════════════════════════════════
# PRODUCT TEMPLATES
# ══════════════════════════════════════════════════════════════════════════════

COLORS_VI_EN = [
    ("đen", "black"), ("trắng", "white"), ("xám", "gray"),
    ("navy", "navy"), ("xanh dương", "blue"), ("xanh lá", "green"),
    ("đỏ", "red"), ("hồng", "pink"), ("vàng", "yellow"),
    ("cam", "orange"), ("tím", "purple"), ("nâu", "brown"),
    ("be", "beige"), ("kem", "cream"), ("bạc", "silver"),
]
SIZES      = ["XS", "S", "M", "L", "XL", "XXL"]
SHOE_SIZES = ["36", "37", "38", "39", "40", "41", "42", "43"]
CONDITIONS = ["new_sealed", "like_new", "excellent", "good", "fair"]
LOCATIONS  = ["HCM", "Hanoi", "Danang", "Cantho", "Binh Duong", "Dong Nai"]

COND_VN = {
    "new_sealed": "mới nguyên seal",
    "like_new":   "như mới, ít dùng",
    "excellent":  "rất tốt, không xước",
    "good":       "tốt, vài vết dùng nhỏ",
    "fair":       "còn dùng được, có dấu hiệu cũ",
}

DESCS = [
    "Mua được {m} tháng, {c}. Còn đẹp, không lỗi. Inbox thương lượng.",
    "Lên đời bán lại, {c}. Dùng nhẹ nhàng, giữ gìn cẩn thận. Giao toàn quốc.",
    "Đồ sinh viên thanh lý, giá mềm. Tình trạng {c}. Cần bán gấp.",
    "Ít dùng, {c}. Hàng chính hãng, có bill. Không fix giá, có thể thương lượng.",
    "Mua mới về không hợp, {c}, còn nguyên tag. Giá cực mềm.",
    "Cần pass lại, {c}. Đã dùng {m} tháng. Gặp trực tiếp hoặc ship toàn quốc.",
    "Mua từ store chính hãng, {c}. Bảo hành còn {w} tháng. Giá thỏa thuận.",
    "Dùng {m} tháng rồi bán lại, {c}. Không có vấn đề gì. Giá fix.",
]

def _desc(cond: str) -> str:
    t = random.choice(DESCS)
    return (t.replace("{m}", str(random.randint(1, 30)))
             .replace("{c}", COND_VN[cond])
             .replace("{w}", str(random.randint(0, 12))))


# ── Electronics ───────────────────────────────────────────────────────────────

PHONES = [
    ("iPhone {m} {s}GB", "smartphone", (8_000_000, 28_000_000)),
    ("Samsung Galaxy {sm} {s}GB", "smartphone", (4_000_000, 20_000_000)),
    ("Xiaomi {xm} {s}GB RAM {r}GB", "smartphone", (2_500_000, 10_000_000)),
    ("OPPO {om} {s}GB", "smartphone", (3_000_000, 9_000_000)),
    ("Realme {rm} {s}GB", "smartphone", (2_000_000, 7_000_000)),
    ("Vivo {vm} {s}GB", "smartphone", (2_500_000, 8_000_000)),
]
LAPTOPS = [
    ("MacBook {mb} {y} {r}GB RAM", "laptop", (12_000_000, 40_000_000)),
    ("Dell {dl} i{c} RAM {r}GB SSD {ss}GB", "laptop", (5_000_000, 25_000_000)),
    ("Asus {as} RAM {r}GB SSD {ss}GB", "laptop", (6_000_000, 22_000_000)),
    ("Lenovo ThinkPad {tp} RAM {r}GB", "laptop", (5_500_000, 20_000_000)),
    ("HP {hp} RAM {r}GB SSD {ss}GB", "laptop", (5_000_000, 18_000_000)),
    ("Acer {ac} RAM {r}GB SSD {ss}GB", "laptop", (4_500_000, 16_000_000)),
    ("MSI {msi} RAM {r}GB SSD {ss}GB", "laptop", (8_000_000, 30_000_000)),
]
AUDIO = [
    ("AirPods {ap}", "audio", (800_000, 5_000_000)),
    ("Tai nghe Sony {sh}", "audio", (600_000, 6_000_000)),
    ("Tai nghe Bose {bh}", "audio", (1_000_000, 8_000_000)),
    ("Tai nghe JBL {jh}", "audio", (300_000, 3_000_000)),
    ("Loa Bluetooth {bl}", "audio", (200_000, 4_000_000)),
]
TABLETS = [
    ("iPad {ip} {is}GB wifi", "tablet", (5_000_000, 20_000_000)),
    ("Samsung Tab {ts} {is}GB", "tablet", (3_500_000, 12_000_000)),
]
PERIPH = [
    ("Chuột {mb2} {mm} không dây", "peripherals", (200_000, 3_000_000)),
    ("Bàn phím cơ {kb} {ks} switch {sw}", "peripherals", (500_000, 5_000_000)),
    ("Màn hình {mn} {mz} inch", "peripherals", (2_000_000, 12_000_000)),
]

E_FILLS = {
    "m":  ["12", "12 Pro", "13", "13 Pro", "14", "14 Plus", "14 Pro", "15", "15 Pro", "16"],
    "s":  ["64", "128", "256", "512"],
    "sm": ["A54", "A53", "S22", "S23", "S23 Ultra", "A34", "S24", "A55"],
    "xm": ["Redmi Note 12", "Redmi Note 13", "POCO X5", "POCO X6", "Xiaomi 13T"],
    "om": ["A78", "A58", "Reno 8", "Reno 10", "Find X6", "A98"],
    "rm": ["GT Neo 5", "11 Pro", "GT 5 Pro"],
    "vm": ["V29", "Y36", "T2 Pro"],
    "r":  ["6", "8", "12", "16", "32"],
    "mb": ["Air M1", "Air M2", "Pro M1", "Pro M2", "Pro 14 M3", "Pro 16 M3"],
    "y":  ["2020", "2021", "2022", "2023", "2024"],
    "dl": ["XPS 13", "XPS 15", "Inspiron 15", "Latitude 5520", "Vostro 15"],
    "c":  ["5", "7", "9", "11", "12", "13"],
    "as": ["ZenBook 14", "VivoBook 15", "ROG Zephyrus G14", "TUF Gaming F15", "ProArt"],
    "tp": ["E14", "X1 Carbon", "T14s", "L15", "X13"],
    "hp": ["EliteBook 840", "ProBook 450", "Pavilion 15", "Envy 13"],
    "ac": ["Swift 3", "Aspire 5", "Nitro 5", "Predator Helios"],
    "msi":["GF63 Thin", "GL66 Pulse", "Creator Z16", "Stealth 15M"],
    "ss": ["256", "512", "1000"],
    "ap": ["2nd Gen", "3rd Gen", "Pro 1st Gen", "Pro 2nd Gen", "Max"],
    "sh": ["WH-1000XM4", "WH-1000XM5", "WF-1000XM5", "WH-CH720N"],
    "bh": ["QC45", "700", "NC700", "QuietComfort Earbuds"],
    "jh": ["Tune 770NC", "Live 660NC", "Quantum 350"],
    "bl": ["JBL Flip 6", "Sony SRS-XB43", "Marshall Emberton", "Bose SoundLink"],
    "ip": ["Air 5", "Air 4", "Pro 11 M2", "Pro 12.9 M2", "Mini 6", "10th Gen", "Air M2"],
    "is": ["64", "128", "256", "512"],
    "ts": ["S8", "S8+", "S9", "S9+", "A9+", "Tab A8"],
    "mb2":["Logitech", "Razer", "Asus", "MSI", "Corsair"],
    "mm": ["MX Master 3", "G305", "DeathAdder V3", "ROG Gladius"],
    "kb": ["Keychron", "Leopold", "Ducky", "AKKO", "Royal Kludge"],
    "ks": ["K2 Pro", "FC750R", "One 3", "3098B", "RK61"],
    "sw": ["Red", "Brown", "Blue", "Black", "Silent Red", "Gateron Yellow"],
    "mn": ["LG 24MK600", "Samsung 27 FHD", "Dell S2421H", "ASUS ProArt"],
    "mz": ["24", "27", "32"],
}

# ── Fashion ───────────────────────────────────────────────────────────────────

FASHION_BRANDS = [
    "Nike", "Adidas", "Uniqlo", "Zara", "H&M", "Champion", "The North Face",
    "Columbia", "Puma", "New Balance", "Converse", "Vans", "MLB", "Balenciaga",
    "Stussy", "Carhartt", "Supreme", "Patagonia", "Arc'teryx", "Levi's",
]
FASHION_TMPLS = [
    # (template, subcategory, price_range, has_gender)
    ("Áo khoác bomber {g} màu {c} size {sz} {b}", "outerwear",   (200_000, 900_000),  True),
    ("Áo khoác dù {g} {b} màu {c} size {sz}",     "outerwear",   (250_000, 950_000),  True),
    ("Áo hoodie {b} {c} size {sz}",               "hoodie",      (120_000, 500_000),  False),
    ("Áo len cardigan {g} {c} size {sz}",         "sweater",     (100_000, 450_000),  True),
    ("Áo blazer {g} {c} size {sz} {b}",           "blazer",      (200_000, 800_000),  True),
    ("Áo thun {b} {c} size {sz} {g}",             "t-shirt",     (60_000,  350_000),  True),
    ("Áo sơ mi {g} {c} size {sz}",                "shirt",       (80_000,  450_000),  True),
    ("Quần jean {g} {c} size {sz} {b}",           "jeans",       (120_000, 600_000),  True),
    ("Quần short {g} {c} size {sz}",              "shorts",      (60_000,  280_000),  True),
    ("Quần tây {g} {c} size {sz}",                "trousers",    (120_000, 550_000),  True),
    ("Váy midi {c} size {sz}",                    "skirt",       (80_000,  400_000),  False),
    ("Đầm {c} size {sz}",                         "dress",       (100_000, 550_000),  False),
    ("Giày {b} {sm} size {ss}",                   "sneakers",    (250_000, 2_500_000),False),
    ("Giày cao gót {c} size {ss}",                "heels",       (80_000,  500_000),  False),
    ("Ba lô {b} {c} đựng laptop {li} inch",       "backpack",    (200_000, 1_200_000),False),
    ("Túi xách {g} {c} {b}",                      "handbag",     (100_000, 800_000),  True),
    ("Ví {g} {c} {b}",                            "wallet",      (50_000,  400_000),  True),
]
SHOE_MODELS = [
    "Air Force 1", "Air Max 90", "Air Max 270", "Stan Smith",
    "Ultraboost 22", "NMD R1", "574", "990v5",
    "Chuck Taylor", "Old Skool", "Authentic", "Classic Leather",
]
GENDERS_VI_EN = [("nữ", "female"), ("nam", "male"), ("unisex", "unisex")]

# ── Books ─────────────────────────────────────────────────────────────────────

BOOK_SUBJECTS = [
    "Giải tích 1", "Giải tích 2", "Đại số tuyến tính", "Xác suất thống kê",
    "Vật lý đại cương", "Hóa đại cương", "Sinh học đại cương",
    "Lập trình C/C++", "Cấu trúc dữ liệu", "Giải thuật", "Mạng máy tính",
    "Cơ sở dữ liệu", "Kỹ thuật phần mềm", "Trí tuệ nhân tạo",
    "Kinh tế vi mô", "Kinh tế vĩ mô", "Marketing căn bản",
    "Kế toán tài chính", "Quản trị kinh doanh", "Luật dân sự",
    "Triết học Mác-Lê", "Tư tưởng Hồ Chí Minh", "Kinh tế chính trị",
]
BOOK_UNIS = ["UET", "NEU", "HCMUT", "UEH", "VNU", "FTU", "RMIT", "BUH", "HUFLIT"]
BOOK_AUTHORS = [
    "Nguyễn Văn A", "Robert Kiyosaki", "Dale Carnegie", "Malcolm Gladwell",
    "Cal Newport", "James Clear", "Adam Grant", "Simon Sinek",
]
BOOK_TITLES = [
    "Atomic Habits", "Deep Work", "Rich Dad Poor Dad", "Thinking Fast and Slow",
    "How to Win Friends", "Zero to One", "The Lean Startup", "Clean Code",
    "Design Patterns", "Cracking the Coding Interview",
]

# ── Vehicles ──────────────────────────────────────────────────────────────────

MOTOS = [
    ("Xe máy Honda {hm} {hy}",   "motorbike", (8_000_000, 38_000_000)),
    ("Xe máy Yamaha {ym} {hy}",  "motorbike", (8_000_000, 32_000_000)),
    ("Xe máy SYM {sm2} {hy}",    "motorbike", (6_000_000, 20_000_000)),
    ("Xe máy Suzuki {szm} {hy}", "motorbike", (5_000_000, 18_000_000)),
]
BIKES = [
    ("Xe đạp {bb} {bt} size {bsz}", "bicycle", (1_000_000, 8_000_000)),
    ("Xe đạp điện {eb} pin {ekm}km","e_bicycle",(2_500_000, 12_000_000)),
]
V_FILLS = {
    "hm":  ["Wave Alpha", "Wave RSX", "Air Blade 150", "Vision", "Lead 125", "Vario 150", "SH 150i", "PCX 160", "Winner X"],
    "ym":  ["Exciter 155", "NVX 155", "Grande 125", "Janus 125", "FreeGo 125", "Nozza Grande"],
    "sm2": ["Attila 125", "GTS 125", "Bonus 110"],
    "szm": ["Raider R150", "GD110 HU"],
    "hy":  ["2017", "2018", "2019", "2020", "2021", "2022", "2023"],
    "bb":  ["Giant", "Trek", "Asama", "Jett", "Twitter", "Merida", "Specialized"],
    "bt":  ["thể thao", "touring", "gấp", "địa hình MTB", "đường trường"],
    "bsz": ["S", "M", "L", "XL", "26 inch", "27.5 inch", "700C"],
    "eb":  ["DTP", "VinFast Klara", "Bridgestone", "Yadea", "Xiaomi"],
    "ekm": ["50", "60", "70", "80", "100"],
}

# ── Furniture / Dorm ──────────────────────────────────────────────────────────

FURNITURE_TMPLS = [
    ("Quạt điện {fb} {ft} {fs} tốc độ",           "fan",       (150_000, 1_200_000)),
    ("Nồi cơm điện {rb} {rl}L",                   "rice_cooker",(200_000, 1_500_000)),
    ("Đèn học {lb} chống mỏi mắt",                "lamp",      (100_000, 700_000)),
    ("Giá sách gỗ {sh2} tầng",                    "shelf",     (300_000, 2_000_000)),
    ("Bàn học gấp gọn rộng {dw}cm",               "desk",      (250_000, 1_800_000)),
    ("Tủ quần áo nhựa {tc} ngăn",                 "wardrobe",  (300_000, 2_500_000)),
    ("Ghế gaming {gc}",                            "chair",     (500_000, 4_000_000)),
    ("Giường gỗ {gw} x {gl}cm",                   "bed",       (1_000_000, 6_000_000)),
    ("Kệ để giày {ks2} tầng",                     "shoe_rack", (100_000, 600_000)),
    ("Máy lọc không khí {ac2}",                   "air_purifier",(500_000, 5_000_000)),
    ("Lò vi sóng {mc}",                           "microwave", (400_000, 2_500_000)),
]
F_FILLS = {
    "fb":  ["Panasonic", "Sunhouse", "Midea", "Asia", "Kangaroo"],
    "ft":  ["đứng", "treo tường", "để bàn", "điều khiển từ xa"],
    "fs":  ["3", "4", "5"],
    "rb":  ["Cuckoo", "Panasonic", "Sunhouse", "Toshiba", "Tiger"],
    "rl":  ["1", "1.5", "1.8", "2"],
    "lb":  ["Philips", "Panasonic", "Wipro", "Rạng Đông", "Xiaomi"],
    "sh2": ["3", "4", "5", "6"],
    "dw":  ["80", "100", "120", "140"],
    "tc":  ["4", "6", "8"],
    "gc":  ["DXRacer", "Secretlab", "AutoFull", "E-Dra"],
    "gw":  ["90", "120", "140", "160"],
    "gl":  ["190", "200", "210"],
    "ks2": ["3", "4", "5"],
    "ac2": ["Xiaomi", "Sharp", "LG", "Philips"],
    "mc":  ["Sharp", "Samsung", "LG", "Panasonic"],
}

# ── Sports ────────────────────────────────────────────────────────────────────

SPORTS_TMPLS = [
    ("Tạ tay {dw2}kg cặp đôi {sb}",               "weights",    (100_000, 1_500_000)),
    ("Tạ đĩa {dw2}kg x{dq} cái",                  "weights",    (80_000, 600_000)),
    ("Bộ tạ xà đơn đa năng {tdw}kg",              "gym_set",    (400_000, 3_000_000)),
    ("Thảm yoga {yb} dày {yt}mm màu {c}",         "yoga_mat",   (80_000, 700_000)),
    ("Dây nhảy {sb} cao cấp",                     "jump_rope",  (30_000, 300_000)),
    ("Vợt cầu lông {bad} {badm}",                 "badminton",  (200_000, 2_500_000)),
    ("Vợt tennis {ten} {tenm}",                   "tennis",     (400_000, 4_000_000)),
    ("Gậy golf {golf} {golfm}",                   "golf",       (500_000, 6_000_000)),
    ("Giày chạy bộ {b} size {ss}",               "running_shoes",(200_000, 2_000_000)),
    ("Xe đạp tập thể dục {sb}",                   "exercise_bike",(800_000, 5_000_000)),
    ("Găng tay boxing {sb} size {sz}",            "boxing",     (80_000, 500_000)),
    ("Bóng đá {sball}",                           "football",   (100_000, 800_000)),
    ("Bóng rổ {sball}",                           "basketball", (100_000, 600_000)),
    ("Bộ quần áo thể thao {b} {g}",              "sportswear", (100_000, 600_000)),
]
S_FILLS = {
    "dw2": ["5", "8", "10", "12", "15", "20"],
    "dq":  ["2", "4"],
    "tdw": ["50", "60", "80", "100"],
    "yb":  ["Manduka", "Lululemon", "Decathlon", "Adidas", "Nike"],
    "yt":  ["4", "6", "8", "10"],
    "sb":  ["Decathlon", "Domyos", "Nike", "Adidas", "Puma", "Reebok"],
    "bad": ["Yonex", "Victor", "Lining", "Kawasaki", "Mizuno"],
    "badm":["Nanoflare 800", "DriveX 9X", "3D Calibar 900", "Astrox 88D Pro", "Super Series"],
    "ten": ["Wilson", "Babolat", "Head", "Prince", "Dunlop"],
    "tenm":["Blade 98", "Pure Drive", "Radical", "Phantom", "Srixon"],
    "golf":["Callaway", "TaylorMade", "Ping", "Titleist", "Cleveland"],
    "golfm":["driver", "iron 7", "putter", "wedge 56", "bộ 9 cây"],
    "sball":["Nike", "Adidas", "Select", "Mikasa", "Spalding"],
}

ALL_FILLS = {**E_FILLS, **V_FILLS, **F_FILLS, **S_FILLS,
             "li": ["13", "14", "15"], "c": "", "g": "", "sz": "", "ss": "", "b": ""}


def _fill(tmpl: str, **overrides) -> str:
    result = tmpl
    fills  = {**ALL_FILLS, **overrides}
    # Replace all {key} with random choice from fills
    import re
    for key in re.findall(r"\{(\w+)\}", tmpl):
        val = fills.get(key)
        if isinstance(val, list):
            result = result.replace("{" + key + "}", random.choice(val), 1)
        elif isinstance(val, str):
            result = result.replace("{" + key + "}", val, 1)
    return " ".join(result.split()).strip()


# ══════════════════════════════════════════════════════════════════════════════
# GENERATORS
# ══════════════════════════════════════════════════════════════════════════════

def _make_electronics(pid: str) -> dict:
    templates = PHONES + LAPTOPS + AUDIO + TABLETS + PERIPH
    tmpl, subcat, price_range = random.choice(templates)
    cond  = random.choice(CONDITIONS)
    loc   = random.choice(LOCATIONS)
    price = random.randint(*price_range) // 10_000 * 10_000
    title = _fill(tmpl)
    return {
        "product_id": pid, "title": title, "description": _desc(cond),
        "category": "electronics", "subcategory": subcat,
        "price": price, "condition": cond, "location": loc,
        "seller_id": f"s{random.randint(1,300):03d}",
        "image_path": None, "image_url": None,
    }


def _make_fashion(pid: str) -> dict:
    tmpl, subcat, price_range, has_gender = random.choice(FASHION_TMPLS)
    color_vi, color_en = random.choice(COLORS_VI_EN)
    size   = random.choice(SIZES)
    shoe_sz= random.choice(SHOE_SIZES)
    brand  = random.choice(FASHION_BRANDS)
    gen_vi, gen_en = random.choice(GENDERS_VI_EN)
    g_adj  = gen_vi if has_gender else ""
    cond   = random.choice(CONDITIONS)
    loc    = random.choice(LOCATIONS)
    price  = random.randint(*price_range) // 10_000 * 10_000
    title  = _fill(tmpl, c=color_vi, sz=size, ss=shoe_sz, b=brand,
                   g=g_adj, sm=random.choice(SHOE_MODELS), li=random.choice(["13","14","15"]))
    return {
        "product_id": pid, "title": title, "description": _desc(cond),
        "category": "fashion", "subcategory": subcat,
        "price": price, "condition": cond, "location": loc,
        "seller_id": f"s{random.randint(1,300):03d}",
        "image_path": None, "image_url": None,
        "_attr": {"color": color_en, "size": size, "gender": gen_en,
                  "brand": brand.lower(), "product_type": subcat},
    }


def _make_book(pid: str) -> dict:
    cond  = random.choice(CONDITIONS)
    loc   = random.choice(LOCATIONS)
    price = random.randint(20_000, 250_000) // 5_000 * 5_000
    if random.random() < 0.6:
        subj = random.choice(BOOK_SUBJECTS)
        uni  = random.choice(BOOK_UNIS)
        vol  = random.choice(["1", "2"])
        title = f"Giáo trình {subj} {uni} tập {vol}"
        subcat = "textbook"
    else:
        author = random.choice(BOOK_AUTHORS)
        btitle = random.choice(BOOK_TITLES)
        ed     = random.choice(["2nd", "3rd", "4th", "5th"])
        title  = f"{author} - {btitle} ({ed} edition)"
        subcat = "reference"
    return {
        "product_id": pid, "title": title, "description": _desc(cond),
        "category": "books", "subcategory": subcat,
        "price": price, "condition": cond, "location": loc,
        "seller_id": f"s{random.randint(1,300):03d}",
        "image_path": None, "image_url": None,
    }


def _make_vehicle(pid: str) -> dict:
    templates = MOTOS + BIKES
    tmpl, subcat, price_range = random.choice(templates)
    cond  = random.choice(CONDITIONS)
    loc   = random.choice(LOCATIONS)
    price = random.randint(*price_range) // 10_000 * 10_000
    title = _fill(tmpl)
    return {
        "product_id": pid, "title": title, "description": _desc(cond),
        "category": "vehicles", "subcategory": subcat,
        "price": price, "condition": cond, "location": loc,
        "seller_id": f"s{random.randint(1,300):03d}",
        "image_path": None, "image_url": None,
    }


def _make_furniture(pid: str) -> dict:
    tmpl, subcat, price_range = random.choice(FURNITURE_TMPLS)
    cond  = random.choice(CONDITIONS)
    loc   = random.choice(LOCATIONS)
    price = random.randint(*price_range) // 10_000 * 10_000
    c_vi, _ = random.choice(COLORS_VI_EN)
    title = _fill(tmpl, c=c_vi)
    return {
        "product_id": pid, "title": title, "description": _desc(cond),
        "category": "furniture", "subcategory": subcat,
        "price": price, "condition": cond, "location": loc,
        "seller_id": f"s{random.randint(1,300):03d}",
        "image_path": None, "image_url": None,
    }


def _make_sports(pid: str) -> dict:
    tmpl, subcat, price_range = random.choice(SPORTS_TMPLS)
    cond  = random.choice(CONDITIONS)
    loc   = random.choice(LOCATIONS)
    price = random.randint(*price_range) // 10_000 * 10_000
    c_vi, _ = random.choice(COLORS_VI_EN)
    g_vi, _ = random.choice(GENDERS_VI_EN)
    title = _fill(tmpl, c=c_vi, g=g_vi,
                  b=random.choice(FASHION_BRANDS),
                  sz=random.choice(SIZES), ss=random.choice(SHOE_SIZES))
    return {
        "product_id": pid, "title": title, "description": _desc(cond),
        "category": "sports", "subcategory": subcat,
        "price": price, "condition": cond, "location": loc,
        "seller_id": f"s{random.randint(1,300):03d}",
        "image_path": None, "image_url": None,
    }


_MAKERS = {
    "electronics": _make_electronics,
    "fashion":     _make_fashion,
    "books":       _make_book,
    "vehicles":    _make_vehicle,
    "furniture":   _make_furniture,
    "sports":      _make_sports,
}

# Target distribution for 3000 new products
_DIST = {
    "electronics": 0.30,  # 900
    "fashion":     0.30,  # 900
    "sports":      0.15,  # 450
    "books":       0.10,  # 300
    "vehicles":    0.08,  # 240
    "furniture":   0.07,  # 210
}


def generate_catalog(
    existing_path: Path,
    n_new:         int = 3000,
) -> tuple[list[dict], list[dict]]:
    existing: list[dict] = []
    if existing_path.exists():
        with open(existing_path) as f:
            for line in f:
                existing.append(json.loads(line))

    max_pid = max(
        (int(p["product_id"][1:]) for p in existing if p["product_id"][1:].isdigit()),
        default=0
    )

    new_products: list[dict] = []
    cats = list(_DIST.keys())
    counts = {c: int(n_new * v) for c, v in _DIST.items()}
    counts[cats[0]] += n_new - sum(counts.values())   # fix rounding

    counter = max_pid + 1
    for cat, n in counts.items():
        for _ in range(n):
            p = _MAKERS[cat](f"p{counter:05d}")
            new_products.append(p)
            counter += 1

    random.shuffle(new_products)
    all_products = existing + new_products

    with open(existing_path, "w", encoding="utf-8") as f:
        for p in all_products:
            clean = {k: v for k, v in p.items() if k != "_attr"}
            f.write(json.dumps(clean, ensure_ascii=False) + "\n")

    cat_counts = {}
    for p in all_products:
        cat_counts[p["category"]] = cat_counts.get(p["category"], 0) + 1
    print(f"✓ Catalog: {len(existing)} + {len(new_products)} = {len(all_products)} total")
    print(f"  Categories: {cat_counts}")
    return all_products, new_products


# ══════════════════════════════════════════════════════════════════════════════
# QUERY TEMPLATES (more diverse)
# ══════════════════════════════════════════════════════════════════════════════

_QUERY_INTROS = [
    "Tìm", "Cần mua", "Ai có", "Muốn mua lại", "Pass không",
    "Cho mình hỏi", "Sinh viên cần", "Mình đang tìm", "Cần gấp",
    "Budget hạn chế, tìm", "Ai đang bán", "Looking for",
]
_QUERY_CONDS = [
    "còn tốt", "còn mới", "như mới", "còn dùng được",
    "tình trạng đẹp", "ít dùng", "tình trạng tốt",
]
_QUERY_OUTROS = [
    "", "ib mình", "nhắn tin", "giá thỏa thuận",
    "giá sinh viên", "giá mềm", "liên hệ",
]
_PRICE_MAXES = [
    "dưới {v}k", "tầm {v}k", "không quá {v}k", "max {v}k", "budget {v}k",
    "dưới {v} triệu", "tầm {v} triệu", "giá {v} triệu",
]

def _price_phrase(product_price: int) -> str:
    budget = int(product_price * random.uniform(1.05, 1.4))
    if budget >= 1_000_000:
        val = budget // 1_000_000
        t   = random.choice([t for t in _PRICE_MAXES if "triệu" in t])
        return t.replace("{v}", str(val))
    else:
        val = budget // 1_000
        t   = random.choice([t for t in _PRICE_MAXES if "k" in t and "triệu" not in t])
        return t.replace("{v}", str(val))


def _build_query(product: dict, style: str = "auto") -> str:
    """
    Build a buyer query for `product`.

    Styles:
      'title'     — based on title directly
      'semantic'  — paraphrase using category signals
      'attribute' — list attributes (color/size/brand)
      'price'     — include price constraint
      'condition' — include condition constraint
      'combined'  — mix of above
      'auto'      — random style
    """
    if style == "auto":
        style = random.choice(["title", "semantic", "attribute", "price", "condition", "combined"])

    title = product["title"]
    cat   = product["category"]
    subcat = product.get("subcategory", "")
    price  = product.get("price", 0)
    cond   = product.get("condition", "good")
    attr   = product.get("_attr", {})

    intro  = random.choice(_QUERY_INTROS)
    outro  = random.choice(_QUERY_OUTROS)

    if style == "title":
        q = f"{intro} {title} {outro}".strip()

    elif style == "semantic":
        # Use subcategory/category as the core noun
        noun = subcat.replace("_", " ") if subcat else cat
        q = f"{intro} {noun} cũ còn dùng tốt {outro}".strip()

    elif style == "attribute" and attr:
        parts = []
        if "product_type" in attr:
            parts.append(attr["product_type"].replace("_", " "))
        elif subcat:
            parts.append(subcat.replace("_", " "))
        if attr.get("gender") and attr["gender"] != "unisex":
            parts.append({"female": "nữ", "male": "nam"}.get(attr["gender"], ""))
        if attr.get("color"):
            # Find VI equivalent
            vi = next((vi for vi, en in COLORS_VI_EN if en == attr["color"]), attr["color"])
            parts.append(f"màu {vi}")
        if attr.get("size"):
            parts.append(f"size {attr['size']}")
        if attr.get("brand") and random.random() < 0.6:
            parts.append(attr["brand"].title())
        noun = " ".join(p for p in parts if p)
        q = f"{intro} {noun} {outro}".strip() if noun else f"{intro} {title} {outro}".strip()

    elif style == "price":
        noun = title.split(" ")[:4]   # short title
        pp   = _price_phrase(price)
        q    = f"{intro} {' '.join(noun)} {pp} {outro}".strip()

    elif style == "condition":
        noun = title.split(" ")[:4]
        cq   = random.choice(_QUERY_CONDS)
        q    = f"{intro} {' '.join(noun)} {cq} {outro}".strip()

    else:  # combined
        parts = [title.split(" ")[:3]]
        if attr.get("color") and random.random() < 0.5:
            vi = next((vi for vi, en in COLORS_VI_EN if en == attr.get("color")), "")
            if vi:
                parts.append([f"màu {vi}"])
        if attr.get("size") and random.random() < 0.5:
            parts.append([f"size {attr['size']}"])
        if random.random() < 0.4:
            parts.append([_price_phrase(price)])
        if random.random() < 0.3:
            parts.append([random.choice(_QUERY_CONDS)])
        flat = [w for p in parts for w in p]
        q = f"{intro} {' '.join(flat)} {outro}".strip()

    # Clean up
    while "  " in q:
        q = q.replace("  ", " ")
    return q.strip()


# ══════════════════════════════════════════════════════════════════════════════
# TRIPLET GENERATION — 4 levels of hard negatives
# ══════════════════════════════════════════════════════════════════════════════

def _neg_l1(pos: dict, all_products: list[dict]) -> dict | None:
    """L1: different category (easy negative)."""
    opts = [p for p in all_products if p["category"] != pos["category"]]
    return random.choice(opts) if opts else None


def _neg_l2(pos: dict, all_products: list[dict]) -> dict | None:
    """L2: same category, different subcategory (medium negative)."""
    opts = [p for p in all_products
            if p["category"] == pos["category"]
            and p["subcategory"] != pos["subcategory"]
            and p["product_id"] != pos["product_id"]]
    return random.choice(opts) if opts else None


def _neg_l3(pos: dict, all_products: list[dict]) -> dict | None:
    """L3: same subcategory, different brand or different condition (hard negative)."""
    pos_attr  = pos.get("_attr", {})
    pos_brand = pos_attr.get("brand")
    pos_cond  = pos.get("condition")

    opts = [p for p in all_products
            if p["subcategory"] == pos["subcategory"]
            and p["product_id"] != pos["product_id"]
            and (p.get("_attr", {}).get("brand") != pos_brand
                 or p.get("condition") != pos_cond)]
    return random.choice(opts) if opts else None


def _neg_l4(pos: dict, all_products: list[dict]) -> dict | None:
    """L4: same subcategory + brand, different color or size (very hard negative)."""
    pos_attr  = pos.get("_attr", {})
    pos_brand = pos_attr.get("brand")
    pos_color = pos_attr.get("color")
    pos_size  = pos_attr.get("size")

    if not pos_brand:
        return _neg_l3(pos, all_products)

    opts = [p for p in all_products
            if p["subcategory"] == pos["subcategory"]
            and p.get("_attr", {}).get("brand") == pos_brand
            and p["product_id"] != pos["product_id"]
            and (p.get("_attr", {}).get("color") != pos_color
                 or p.get("_attr", {}).get("size") != pos_size)]
    if not opts:
        return _neg_l3(pos, all_products)
    return random.choice(opts)


_NEG_FNS = [_neg_l1, _neg_l2, _neg_l3, _neg_l4]
# Weight toward harder negatives (more useful for training)
_NEG_WEIGHTS = [0.10, 0.20, 0.35, 0.35]


def generate_triplets(
    all_products:  list[dict],
    n_triplets:    int,
    train_path:    Path,
    val_path:      Path,
    val_ratio:     float = 0.12,
    start_idx:     int   = 0,
) -> None:
    # Index by category / subcategory for fast lookup
    by_cat    = {}
    by_subcat = {}
    for p in all_products:
        by_cat.setdefault(p["category"], []).append(p)
        by_subcat.setdefault(p["subcategory"], []).append(p)

    # Style distribution for queries
    styles = ["title", "semantic", "attribute", "price", "condition", "combined"]
    style_w = [0.15, 0.10, 0.30, 0.20, 0.10, 0.15]

    triplets: list[dict] = []
    attempts = 0
    while len(triplets) < n_triplets and attempts < n_triplets * 10:
        attempts += 1
        pos = random.choice(all_products)

        # Choose negative level via weighted random
        neg_fn = random.choices(_NEG_FNS, weights=_NEG_WEIGHTS, k=1)[0]
        neg    = neg_fn(pos, all_products)
        if neg is None:
            continue

        style = random.choices(styles, weights=style_w, k=1)[0]
        query = _build_query(pos, style=style)

        triplets.append({
            "query_id":            f"q{start_idx + len(triplets) + 1:06d}",
            "query":               query,
            "positive_product_id": pos["product_id"],
            "negative_product_id": neg["product_id"],
            "positive_score":      1.0,
            "negative_score":      0.0,
        })

    random.shuffle(triplets)
    split  = int(len(triplets) * (1 - val_ratio))
    train_ = triplets[:split]
    val_   = triplets[split:]

    for path, data in [(train_path, train_), (val_path, val_)]:
        with open(path, "a", encoding="utf-8") as f:
            for t in data:
                f.write(json.dumps(t, ensure_ascii=False) + "\n")

    print(f"✓ Triplets: +{len(train_)} train, +{len(val_)} val")


# ══════════════════════════════════════════════════════════════════════════════
# ADVERSARIAL TRIPLETS — context-word confusion
# ══════════════════════════════════════════════════════════════════════════════

# Keywords that appear as context in titles of OTHER categories
# e.g. "Ba lô đựng laptop" → laptop is context, not the product
_CONTEXT_WORD_MAP = {
    # keyword → (true_subcategory, confusing_subcategory_patterns)
    "laptop":        ("laptop",      ["backpack", "bag", "handbag", "wallet"]),
    "điện thoại":    ("smartphone",  ["backpack", "wallet", "handbag"]),
    "iphone":        ("smartphone",  ["backpack", "wallet", "handbag"]),
    "macbook":       ("laptop",      ["backpack", "bag"]),
    "giày":          ("sneakers",    ["sportswear", "t-shirt", "jeans"]),
    "áo":            ("t-shirt",     ["backpack", "jeans", "sneakers", "shoes"]),
    "vợt":           ("badminton",   ["sportswear", "weights"]),
    "xe đạp":        ("bicycle",     ["exercise_bike", "running_shoes"]),
}

_ADVERSARIAL_QUERIES = {
    "laptop": [
        "laptop cũ", "laptop sinh viên", "laptop giá rẻ",
        "cần mua laptop", "tìm laptop", "laptop gaming",
        "laptop văn phòng", "máy tính xách tay", "laptop secondhand",
    ],
    "điện thoại": [
        "điện thoại cũ", "điện thoại giá rẻ", "cần mua điện thoại",
        "tìm điện thoại", "smartphone secondhand",
    ],
    "iphone": [
        "iphone cũ", "cần mua iphone", "iphone secondhand", "iphone giá tốt",
    ],
    "macbook": [
        "macbook cũ", "cần mua macbook", "macbook secondhand",
    ],
    "giày": [
        "giày thể thao cũ", "cần mua giày", "giày secondhand",
    ],
    "áo": [
        "áo cũ", "áo thun", "áo khoác",
    ],
    "vợt": [
        "vợt cầu lông cũ", "cần mua vợt", "vợt tennis cũ",
    ],
    "xe đạp": [
        "xe đạp cũ", "cần mua xe đạp", "xe đạp thể thao",
    ],
}


def generate_adversarial_triplets(
    all_products:  list[dict],
    train_path:    Path,
    val_path:      Path,
    n_per_keyword: int   = 300,
    val_ratio:     float = 0.12,
    start_idx:     int   = 0,
) -> None:
    """
    Tạo triplets đặc biệt cho trường hợp context-word confusion.

    Ví dụ: query="laptop"
      positive = sản phẩm laptop thật (subcategory=laptop)
      negative = "Ba lô đựng laptop" (subcategory=backpack, chứa "laptop" trong title)

    Đây là loại lỗi nguy hiểm nhất của BM25 + random-weight FAISS.
    """
    # Index by subcategory
    by_subcat: dict[str, list[dict]] = {}
    for p in all_products:
        by_subcat.setdefault(p["subcategory"], []).append(p)

    triplets: list[dict] = []
    qid = start_idx

    for keyword, (true_sub, confusing_subs) in _CONTEXT_WORD_MAP.items():
        true_products = by_subcat.get(true_sub, [])
        if not true_products:
            continue

        # Confusing: products in other subcategories that mention keyword in title
        confusing = []
        for csub in confusing_subs:
            for p in by_subcat.get(csub, []):
                if keyword.lower() in p["title"].lower():
                    confusing.append(p)

        if not confusing:
            # Fallback: just products from confusing subcategories
            for csub in confusing_subs:
                confusing.extend(by_subcat.get(csub, []))

        if not confusing or not true_products:
            continue

        queries = _ADVERSARIAL_QUERIES.get(keyword, [f"tìm {keyword}"])

        for _ in range(n_per_keyword):
            pos = random.choice(true_products)
            neg = random.choice(confusing)
            if pos["product_id"] == neg["product_id"]:
                continue
            q = random.choice(queries)
            triplets.append({
                "query_id":            f"qa{qid:06d}",
                "query":               q,
                "positive_product_id": pos["product_id"],
                "negative_product_id": neg["product_id"],
                "positive_score":      1.0,
                "negative_score":      0.0,
            })
            qid += 1

    random.shuffle(triplets)
    split  = int(len(triplets) * (1 - val_ratio))

    for path, data in [(train_path, triplets[:split]), (val_path, triplets[split:])]:
        with open(path, "a", encoding="utf-8") as f:
            for t in data:
                f.write(json.dumps(t, ensure_ascii=False) + "\n")

    print(f"✓ Adversarial triplets: +{split} train, +{len(triplets)-split} val  ({len(triplets)} total)")


# ══════════════════════════════════════════════════════════════════════════════
# PARSER QUERIES (more diverse)
# ══════════════════════════════════════════════════════════════════════════════

_CAT_KEYWORDS = {
    "electronics": [
        "laptop", "máy tính", "điện thoại", "iphone", "samsung", "macbook",
        "tai nghe", "airpods", "tablet", "ipad", "màn hình", "chuột", "bàn phím",
        "loa bluetooth", "sạc dự phòng", "ổ cứng",
    ],
    "fashion": [
        "áo khoác", "áo thun", "quần jean", "giày thể thao", "ba lô",
        "túi xách", "váy", "đầm", "áo hoodie", "quần short",
        "giày nike", "adidas", "uniqlo", "sneakers",
    ],
    "books": [
        "giáo trình", "sách", "tài liệu", "sách bài tập", "sách chuyên ngành",
        "đề cương", "sách tham khảo", "sách tiếng anh",
    ],
    "vehicles": [
        "xe máy", "xe đạp", "xe điện", "honda", "yamaha", "xe đạp thể thao",
        "xe gấp", "xe số", "xe tay ga",
    ],
    "furniture": [
        "bàn học", "ghế", "kệ sách", "quạt", "nồi cơm", "đèn học",
        "tủ quần áo", "giường", "máy lọc không khí", "lò vi sóng",
    ],
    "sports": [
        "tạ", "thảm yoga", "vợt cầu lông", "vợt tennis", "giày chạy bộ",
        "xe đạp tập", "dây nhảy", "gậy golf", "dụng cụ gym",
    ],
}

_PARSER_TEMPLATES = [
    "{intro} {kw} {outro}",
    "{intro} {kw} màu {c} {outro}",
    "{intro} {kw} size {sz} {outro}",
    "{intro} {kw} {price} {outro}",
    "{intro} {kw} {cond} {outro}",
    "{intro} {kw} {g} {outro}",
    "{intro} {kw} màu {c} size {sz} {outro}",
    "{intro} {kw} màu {c} {price} {outro}",
    "{intro} {kw} size {sz} {price} {outro}",
    "{intro} {kw} {g} màu {c} {outro}",
    "{intro} {kw} {g} size {sz} {price} {outro}",
    "{intro} {kw} màu {c} size {sz} {price} {outro}",
    "{intro} {kw} {g} màu {c} size {sz} {price} {cond} {outro}",
]

def _rand_price() -> str:
    if random.random() < 0.5:
        v = random.randint(1, 15)
        return random.choice(["dưới", "tầm", "budget"]) + f" {v} triệu"
    else:
        v = random.randint(1, 30) * 100
        return random.choice(["dưới", "tầm", "không quá"]) + f" {v}k"


def generate_parser_queries(out_path: Path, n: int = 5000, val_ratio: float = 0.15) -> None:
    records: list[dict] = []
    for _ in range(n):
        cat    = random.choice(list(_CAT_KEYWORDS.keys()))
        kw     = random.choice(_CAT_KEYWORDS[cat])
        c_vi, _= random.choice(COLORS_VI_EN)
        sz     = random.choice(SIZES)
        g_vi, _= random.choice(GENDERS_VI_EN)
        cond   = random.choice(_QUERY_CONDS)
        intro  = random.choice(_QUERY_INTROS)
        outro  = random.choice(_QUERY_OUTROS)
        price  = _rand_price()

        tmpl = random.choice(_PARSER_TEMPLATES)
        q = (tmpl
             .replace("{kw}",    kw)
             .replace("{c}",     c_vi)
             .replace("{sz}",    sz)
             .replace("{g}",     g_vi)
             .replace("{cond}",  cond)
             .replace("{price}", price)
             .replace("{intro}", intro)
             .replace("{outro}", outro))
        while "  " in q:
            q = q.replace("  ", " ")

        records.append({"query": q.strip(), "category": cat})

    random.shuffle(records)
    split = int(len(records) * (1 - val_ratio))

    for path, data in [
        (out_path.parent / "parser_train.jsonl", records[:split]),
        (out_path.parent / "parser_val.jsonl",   records[split:]),
    ]:
        with open(path, "a", encoding="utf-8") as f:
            for r in data:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")

    print(f"✓ Parser queries: +{split} train, +{len(records)-split} val")


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n_products",   type=int, default=3000)
    ap.add_argument("--n_triplets",   type=int, default=20000)
    ap.add_argument("--n_parser",     type=int, default=8000)
    ap.add_argument("--seed",         type=int, default=777)
    args = ap.parse_args()

    random.seed(args.seed)
    data_dir = Path("data/processed")
    data_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n── Step 1: Catalog (+{args.n_products} products) ──")
    all_products, new_products = generate_catalog(
        data_dir / "catalog.jsonl",
        n_new=args.n_products,
    )

    # Count existing triplets to continue numbering
    n_existing = 0
    tp = data_dir / "train.jsonl"
    vp = data_dir / "val.jsonl"
    if tp.exists():
        with open(tp) as f:
            n_existing = sum(1 for _ in f)

    print(f"\n── Step 2: Triplets (+{args.n_triplets}) ──")
    generate_triplets(
        all_products,
        n_triplets  = args.n_triplets,
        train_path  = tp,
        val_path    = vp,
        start_idx   = n_existing,
    )

    # Count triplets so far for correct start_idx
    n_after_regular = 0
    if tp.exists():
        with open(tp) as f:
            n_after_regular = sum(1 for _ in f)

    print(f"\n── Step 2b: Adversarial triplets (context-word confusion) ──")
    generate_adversarial_triplets(
        all_products,
        train_path = tp,
        val_path   = vp,
        start_idx  = n_after_regular,
    )

    print(f"\n── Step 3: Parser queries (+{args.n_parser}) ──")
    generate_parser_queries(data_dir / "parser_train.jsonl", n=args.n_parser)

    print("\n── Final summary ──")
    for f in sorted(data_dir.glob("*.jsonl")):
        n = sum(1 for _ in open(f))
        print(f"  {f.name:30s}: {n:>7,}")

    print("\n✓ Done. Next:")
    print("  python scripts/build_index.py")
    print("  python scripts/train_pipeline.py --stage all --epochs 15")
    print("  python scripts/train.py --model biencoder --epochs 20")


if __name__ == "__main__":
    main()
