"""
src/pipeline/stage0/__init__.py
Stage 0 — Query Understanding

Làm DUY NHẤT: biến raw query → ParsedQuery có cấu trúc rõ ràng.

Sub-stages:
  A. Normalize       — unicode NFC, lowercase, whitespace
  B. Attribute extract (rule-based):
       - color, size, gender, brand, style → SoftPreferences (RawSpan)
       - price range                       → HardConstraints.price (RawSpan)
       - condition                         → Hard (floor) hoặc Soft (preferred)
       - urgency                           → signal string
  C. Keyword extract (KeyBERT):
       - top-N semantic keywords + scores
  D. Category classify (learned MLP):
       - top-K categories + confidence → CategoryRouting

Nguyên tắc:
  - Null thật sự khi không tìm thấy, không đoán bừa
  - Mỗi extracted value giữ cả raw text và normalized form (RawSpan)
  - Hard vs Soft phân biệt rõ (xem schemas/query.py)
  - Mọi sub-stage thất bại → log + return partial result, không crash
"""
from __future__ import annotations

import re
import unicodedata
from pathlib import Path
from typing import Any

import torch
import torch.nn as nn
import torch.nn.functional as F
from keybert import KeyBERT
from sentence_transformers import SentenceTransformer

from src.schemas.query import (
    CategoryRouting,
    HardConstraints,
    ParsedQuery,
    PriceRange,
    RawSpan,
    SoftPreferences,
)
from src.utils import get_logger

logger = get_logger(__name__)


# ══════════════════════════════════════════════════════════════════════════════
# A. NORMALIZE
# ══════════════════════════════════════════════════════════════════════════════

_WHITESPACE_RE = re.compile(r"\s+")


def normalize_query(text: str) -> str:
    """Unicode NFC + lowercase + collapse whitespace."""
    text = unicodedata.normalize("NFC", text)
    text = text.lower().strip()
    text = _WHITESPACE_RE.sub(" ", text)
    return text


# ══════════════════════════════════════════════════════════════════════════════
# B. ATTRIBUTE & CONSTRAINT EXTRACTION (rule-based)
# ══════════════════════════════════════════════════════════════════════════════

# ── Color ─────────────────────────────────────────────────────────────────────

_COLOR_MAP: list[tuple[str, str]] = sorted([
    # Vietnamese         → English canonical
    ("xanh navy",        "navy"),
    ("xanh lá cây",      "green"),
    ("xanh da trời",     "blue"),
    ("xanh lam",         "blue"),
    ("xanh lá",          "green"),
    ("vàng đồng",        "gold"),
    ("xanh",             "blue"),
    ("đen",              "black"),
    ("trắng",            "white"),
    ("đỏ",               "red"),
    ("vàng",             "yellow"),
    ("cam",              "orange"),
    ("hồng",             "pink"),
    ("tím",              "purple"),
    ("xám",              "gray"),
    ("nâu",              "brown"),
    ("kem",              "cream"),
    ("be",               "beige"),
    ("bạc",              "silver"),
    # English passthrough
    ("black",            "black"),
    ("white",            "white"),
    ("red",              "red"),
    ("blue",             "blue"),
    ("green",            "green"),
    ("pink",             "pink"),
    ("gray",             "gray"),
    ("grey",             "gray"),
    ("brown",            "brown"),
    ("navy",             "navy"),
    ("beige",            "beige"),
    ("gold",             "gold"),
    ("silver",           "silver"),
], key=lambda x: -len(x[0]))   # longest match first


def extract_color(text: str) -> RawSpan | None:
    """Longest-match color lookup. Returns RawSpan or None."""
    for vi_raw, en_norm in _COLOR_MAP:
        if vi_raw in text:
            return RawSpan(raw=vi_raw, normalized=en_norm, confidence=1.0)
    return None


# ── Size ──────────────────────────────────────────────────────────────────────

_SIZE_RE = re.compile(
    r"\bsize\s+([SMLX]+L*)\b"           # "size L", "size XL"
    r"|\b(XS|S|M|L|XL|XXL|XXXL)\b"     # standalone "L"
    r"|\bsize\s+(\d{2,3})\b"            # "size 38"
    r"|\b(3[5-9]|4[0-6])\b",            # shoe sizes: 35-46
    re.IGNORECASE,
)


def extract_size(text: str) -> RawSpan | None:
    m = _SIZE_RE.search(text)
    if not m:
        return None
    val = next(g for g in m.groups() if g is not None)
    return RawSpan(raw=m.group(0).strip(), normalized=val.upper(), confidence=1.0)


# ── Gender ────────────────────────────────────────────────────────────────────

_GENDER_MAP: list[tuple[str, str]] = sorted([
    ("nữ",     "female"),
    ("nam",    "male"),
    ("unisex", "unisex"),
    ("women",  "female"),
    ("woman",  "female"),
    ("men",    "male"),
    ("man",    "male"),
    ("girl",   "female"),
    ("boy",    "male"),
], key=lambda x: -len(x[0]))


def extract_gender(text: str) -> RawSpan | None:
    for raw, norm in _GENDER_MAP:
        if re.search(r"\b" + re.escape(raw) + r"\b", text):
            return RawSpan(raw=raw, normalized=norm, confidence=1.0)
    return None


# ── Brand ─────────────────────────────────────────────────────────────────────

_KNOWN_BRANDS: list[str] = sorted([
    # Tech
    "apple", "samsung", "xiaomi", "oppo", "vivo", "realme", "huawei",
    "asus", "dell", "hp", "lenovo", "acer", "msi", "lg", "sony",
    "iphone", "ipad", "macbook",
    # Fashion
    "nike", "adidas", "puma", "new balance", "converse", "vans",
    "gucci", "zara", "uniqlo", "h&m", "balenciaga",
    # Bikes
    "giant", "trek", "specialized",
], key=lambda x: -len(x))   # longest first

_BRAND_RE = re.compile(
    r"\b(" + "|".join(re.escape(b) for b in _KNOWN_BRANDS) + r")\b",
    re.IGNORECASE,
)


def extract_brand(text: str) -> RawSpan | None:
    m = _BRAND_RE.search(text)
    if not m:
        return None
    raw  = m.group(0)
    norm = raw.lower()
    return RawSpan(raw=raw, normalized=norm, confidence=1.0)


# ── Style ─────────────────────────────────────────────────────────────────────

_STYLE_MAP: list[tuple[str, str]] = sorted([
    ("bomber",      "bomber"),
    ("hoodie",      "hoodie"),
    ("slim fit",    "slim_fit"),
    ("slim-fit",    "slim_fit"),
    ("oversize",    "oversized"),
    ("oversized",   "oversized"),
    ("regular fit", "regular_fit"),
    ("crop",        "crop"),
    ("crop top",    "crop_top"),
    ("cardigan",    "cardigan"),
    ("sweater",     "sweater"),
    ("blazer",      "blazer"),
    ("parka",       "parka"),
    ("trench",      "trench"),
    ("windbreaker", "windbreaker"),
], key=lambda x: -len(x[0]))


def extract_style(text: str) -> RawSpan | None:
    for raw, norm in _STYLE_MAP:
        if raw in text:
            return RawSpan(raw=raw, normalized=norm, confidence=1.0)
    return None


# ── Price (Hard Constraint) ───────────────────────────────────────────────────

_PRICE_NUM  = r"(\d+(?:[.,]\d+)?)"
_PRICE_UNIT = r"(triệu|tr|k|nghìn|đồng|vnd)?"
_PT         = _PRICE_NUM + r"\s*" + _PRICE_UNIT   # price token

_RANGE_RE  = re.compile(_PT + r"\s*[-–đến]+\s*" + _PT, re.IGNORECASE | re.UNICODE)
_MAX_RE    = re.compile(r"(dưới|tối đa|max|không quá|under|below)\s*" + _PT, re.IGNORECASE | re.UNICODE)
_MIN_RE    = re.compile(r"(trên|từ|above|min)\s*" + _PT, re.IGNORECASE | re.UNICODE)
_BUDGET_RE = re.compile(r"(budget|tầm|khoảng|giá)\s*" + _PT, re.IGNORECASE | re.UNICODE)
_PLAIN_RE  = re.compile(_PT, re.IGNORECASE | re.UNICODE)


def _to_vnd(num_str: str, unit_str: str | None) -> float:
    val  = float(num_str.replace(",", "."))
    unit = (unit_str or "").lower()
    if "triệu" in unit or unit == "tr":
        return val * 1_000_000
    if unit == "k" or "nghìn" in unit:
        return val * 1_000
    # Ambiguous bare number: heuristic
    if val < 100:
        return val * 1_000_000   # "3" → 3 triệu
    if val < 10_000:
        return val * 1_000       # "300" → 300k
    return val


def extract_price_range(text: str) -> PriceRange:
    """
    Trích xuất khoảng giá từ query. Trả về PriceRange với RawSpan hoặc None.

    Ưu tiên: explicit range > max phrase > min phrase > budget phrase > bare price.
    """
    # "300k–500k" hoặc "3 triệu đến 5 triệu"
    m = _RANGE_RE.search(text)
    if m:
        raw_text = m.group(0)
        lo = _to_vnd(m.group(1), m.group(2))
        hi = _to_vnd(m.group(3), m.group(4))
        mn, mx = (min(lo, hi), max(lo, hi))
        return PriceRange(
            min=RawSpan(raw=raw_text, normalized=mn),
            max=RawSpan(raw=raw_text, normalized=mx),
        )

    # "dưới 5 triệu"
    m = _MAX_RE.search(text)
    if m:
        raw_text = m.group(0)
        val = _to_vnd(m.group(2), m.group(3))
        return PriceRange(max=RawSpan(raw=raw_text, normalized=val))

    # "từ 3 triệu"
    m = _MIN_RE.search(text)
    if m:
        raw_text = m.group(0)
        val = _to_vnd(m.group(2), m.group(3))
        return PriceRange(min=RawSpan(raw=raw_text, normalized=val))

    # "budget 300k"
    m = _BUDGET_RE.search(text)
    if m:
        raw_text = m.group(0)
        val = _to_vnd(m.group(2), m.group(3))
        return PriceRange(max=RawSpan(raw=raw_text, normalized=val))

    # Bare price token với đơn vị rõ: "300k" → coi là max budget
    m = _PLAIN_RE.search(text)
    if m and m.group(2):    # phải có unit (không match số trần)
        raw_text = m.group(0)
        val = _to_vnd(m.group(1), m.group(2))
        return PriceRange(max=RawSpan(raw=raw_text, normalized=val))

    return PriceRange()   # không tìm thấy gì → min=None, max=None


# ── Condition ─────────────────────────────────────────────────────────────────

# Chuỗi condition label theo thứ tự tốt → xấu
_CONDITION_ORDER = ["new_sealed", "like_new", "excellent", "good", "fair"]

# Keywords mạnh → hard (floor): buyer YÊU CẦU ít nhất condition này
_HARD_CONDITION_MAP: list[tuple[str, str]] = sorted([
    ("mới nguyên seal", "new_sealed"),
    ("new seal",        "new_sealed"),
    ("chưa khui",       "new_sealed"),
    ("seal",            "new_sealed"),
    ("như mới",         "like_new"),
    ("like new",        "like_new"),
    ("lnib",            "like_new"),
    ("ít dùng",         "like_new"),
    ("mới 99",          "like_new"),
    ("còn tốt",         "good"),
    ("còn mới",         "like_new"),
    ("không xước",      "excellent"),
    ("không trầy",      "excellent"),
    ("tình trạng tốt",  "good"),
], key=lambda x: -len(x[0]))

# Keywords nhẹ hơn → soft (preferred): buyer THÍCH nhưng không cứng
_SOFT_CONDITION_MAP: list[tuple[str, str]] = sorted([
    ("đẹp",             "excellent"),
    ("tốt",             "good"),
    ("good",            "good"),
    ("cũ",              "fair"),
    ("dùng lâu",        "fair"),
    ("secondhand",      "fair"),
    ("second hand",     "fair"),
    ("99%",             "like_new"),
    ("98%",             "like_new"),
    ("95%",             "excellent"),
    ("90%",             "good"),
], key=lambda x: -len(x[0]))


def extract_condition(text: str) -> tuple[RawSpan | None, RawSpan | None]:
    """
    Trả về (hard_floor, soft_preferred).

    Logic:
      - Nếu match hard keyword → condition_floor (hard), soft=None
      - Nếu match soft keyword → soft_preferred (soft), hard=None
      - Nếu không match → (None, None)
    """
    for raw, norm in _HARD_CONDITION_MAP:
        if raw in text:
            return RawSpan(raw=raw, normalized=norm, confidence=1.0), None

    for raw, norm in _SOFT_CONDITION_MAP:
        if raw in text:
            return None, RawSpan(raw=raw, normalized=norm, confidence=0.8)

    return None, None


# ── Product Type ─────────────────────────────────────────────────────────────

_PRODUCT_TYPE_MAP: list[tuple[str, str]] = sorted([
    # Thời trang (fashion)
    ("áo khoác bomber", "bomber_jacket"),
    ("áo khoác",        "outerwear"),
    ("áo hoodie",       "hoodie"),
    ("áo len",          "sweater"),
    ("áo thun",         "t-shirt"),
    ("áo sơ mi",        "shirt"),
    ("áo vest",         "blazer"),
    ("quần jean",       "jeans"),
    ("quần short",      "shorts"),
    ("quần tây",        "trousers"),
    ("váy",             "skirt"),
    ("đầm",             "dress"),
    ("giày thể thao",   "sneakers"),
    ("giày cao gót",    "heels"),
    ("giày",            "shoes"),
    ("dép",             "sandals"),
    ("túi xách",        "handbag"),
    ("ba lô",           "backpack"),
    ("ví",              "wallet"),
    # Điện tử (electronics)
    ("điện thoại",      "smartphone"),
    ("laptop",          "laptop"),
    ("máy tính xách tay", "laptop"),
    ("máy tính bảng",   "tablet"),
    ("iphone",          "smartphone"),
    ("ipad",            "tablet"),
    ("macbook",         "laptop"),
    ("tai nghe",        "headphones"),
    ("airpods",         "earbuds"),
    ("đồng hồ thông minh", "smartwatch"),
    ("smartwatch",      "smartwatch"),
    ("máy ảnh",         "camera"),
    ("camera",          "camera"),
    ("loa",             "speaker"),
    ("bàn phím",        "keyboard"),
    ("chuột",           "mouse"),
    # Xe (vehicles)
    ("xe máy",          "motorcycle"),
    ("xe đạp",          "bicycle"),
    ("ô tô",            "car"),
    ("xe điện",         "e-bike"),
    # Sách (books)
    ("sách",            "book"),
    ("giáo trình",      "textbook"),
    # Nội thất (furniture)
    ("bàn",             "desk"),
    ("ghế",             "chair"),
    ("giường",          "bed"),
    ("tủ",              "cabinet"),
    ("kệ",              "shelf"),
    # Thể thao (sports)
    ("tạ",              "weights"),
    ("gậy golf",        "golf_club"),
    ("vợt",             "racket"),
    ("gậy bóng chày",   "baseball_bat"),
    # English passthrough
    ("jacket",          "outerwear"),
    ("t-shirt",         "t-shirt"),
    ("sneakers",        "sneakers"),
    ("laptop",          "laptop"),
    ("smartphone",      "smartphone"),
    ("headphones",      "headphones"),
    ("backpack",        "backpack"),
], key=lambda x: -len(x[0]))   # longest match first


def extract_product_type(text: str) -> RawSpan | None:
    """Longest-match product type lookup. Returns RawSpan or None."""
    for vi_raw, en_norm in _PRODUCT_TYPE_MAP:
        if vi_raw in text:
            return RawSpan(raw=vi_raw, normalized=en_norm, confidence=1.0)
    return None


# ── Urgency ───────────────────────────────────────────────────────────────────

_URGENCY_MAP: list[tuple[str, str]] = sorted([
    ("cần gấp",  "high"),
    ("cần ngay", "high"),
    ("gấp",      "high"),
    ("urgent",   "high"),
    ("asap",     "high"),
    ("hôm nay",  "high"),
    ("ngày mai", "high"),
    ("sớm",      "medium"),
    ("tuần này", "medium"),
    ("cuối tuần","medium"),
], key=lambda x: -len(x[0]))


def extract_urgency(text: str) -> str:
    for raw, level in _URGENCY_MAP:
        if raw in text:
            return level
    return "low"


# ══════════════════════════════════════════════════════════════════════════════
# C. KEYWORD EXTRACTION (KeyBERT)
# ══════════════════════════════════════════════════════════════════════════════

_MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"
_kw_model: KeyBERT | None = None

_VI_STOPWORDS = {
    "tôi", "mình", "bạn", "ai", "có", "không", "và", "để", "với",
    "trong", "của", "cho", "là", "được", "đang", "muốn", "cần",
    "tìm", "mua", "bán", "ib", "nhắn", "hỏi", "ạ", "nhé", "thôi",
    "nha", "ơi", "vậy", "thì", "mà", "nên", "rồi", "giá", "còn",
    "đã", "chưa", "hay", "hoặc", "nếu", "theo", "lên", "xuống",
    "the", "a", "an", "is", "for", "of", "to", "in", "at",
    "ở", "vẫn", "đến", "từ", "lại", "ra", "vào", "đi", "về",
    "này", "đó", "kia", "đây", "nào", "sao", "thế", "quá",
    "ai", "pass", "thanh", "lý", "cần", "mua",
}


def _get_kw_model() -> KeyBERT:
    global _kw_model
    if _kw_model is None:
        logger.info(f"Loading KeyBERT ({_MODEL_NAME})...")
        _kw_model = KeyBERT(model=SentenceTransformer(_MODEL_NAME))
        logger.info("KeyBERT ready.")
    return _kw_model


def extract_keywords(
    text: str,
    top_n: int = 6,
) -> tuple[list[str], dict[str, float]]:
    """
    KeyBERT keyword extraction với MMR diversity.
    Trả về (keywords, keyword_scores).
    """
    kw_model = _get_kw_model()
    raw = kw_model.extract_keywords(
        text,
        keyphrase_ngram_range=(1, 3),
        stop_words=list(_VI_STOPWORDS),
        top_n=top_n * 2,
        use_mmr=True,
        diversity=0.5,
    )
    filtered = [
        (phrase, round(score, 4))
        for phrase, score in raw
        if len(phrase) > 1 and phrase.lower() not in _VI_STOPWORDS
    ][:top_n]

    keywords = [kw for kw, _ in filtered]
    scores   = {kw: sc for kw, sc in filtered}
    return keywords, scores


# ══════════════════════════════════════════════════════════════════════════════
# D. CATEGORY CLASSIFIER (learned MLP)
# ══════════════════════════════════════════════════════════════════════════════

CATEGORIES = ["electronics", "books", "vehicles", "furniture", "fashion", "sports"]
CAT2IDX    = {c: i for i, c in enumerate(CATEGORIES)}
IDX2CAT    = {i: c for c, i in CAT2IDX.items()}


class CategoryClassifier(nn.Module):
    """Lightweight MLP: embedding → category logits."""

    def __init__(self, embed_dim: int = 384, num_classes: int = len(CATEGORIES), hidden: int = 128):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(embed_dim, hidden),
            nn.GELU(),
            nn.Dropout(0.15),
            nn.Linear(hidden, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


# ══════════════════════════════════════════════════════════════════════════════
# QUERY PARSER — orchestrates A → B → C → D
# ══════════════════════════════════════════════════════════════════════════════

class QueryParser:
    """
    Stage 0 orchestrator: raw query → ParsedQuery.

    Mỗi sub-stage thất bại đều có fallback — không crash toàn pipeline.
    """

    CATEGORY_CONFIDENCE_THRESHOLD = 0.35

    def __init__(
        self,
        embed_fn=None,
        classifier: CategoryClassifier | None = None,
        device: torch.device | None = None,
        kw_top_n: int = 6,
    ):
        self.embed_fn   = embed_fn
        self.classifier = classifier
        self.device     = device or torch.device("cpu")
        self.kw_top_n   = kw_top_n

        if self.classifier is not None:
            self.classifier = self.classifier.to(self.device).eval()

    @classmethod
    def load(
        cls,
        checkpoint_path: str | Path,
        embed_fn,
        device: torch.device | None = None,
    ) -> "QueryParser":
        device = device or torch.device("cpu")
        ckpt   = torch.load(checkpoint_path, map_location="cpu")
        clf    = CategoryClassifier(
            embed_dim   = ckpt["embed_dim"],
            num_classes = ckpt["num_classes"],
            hidden      = ckpt.get("hidden", 128),
        )
        clf.load_state_dict(ckpt["model_state"])
        logger.info(f"CategoryClassifier loaded from {checkpoint_path}")
        return cls(embed_fn, clf, device)

    def parse(self, raw_query: str) -> ParsedQuery:
        # A. Normalize
        normalized = normalize_query(raw_query)

        # B. Extract soft preferences (rule-based)
        color        = extract_color(normalized)
        size         = extract_size(normalized)
        gender       = extract_gender(normalized)
        brand        = extract_brand(normalized)
        style        = extract_style(normalized)
        urgency      = extract_urgency(normalized)
        product_type = extract_product_type(normalized)

        # B. Extract constraints (rule-based)
        price_range               = extract_price_range(normalized)
        condition_hard, cond_soft = extract_condition(normalized)

        hard = HardConstraints(
            price           = price_range,
            condition_floor = condition_hard,
        )
        soft = SoftPreferences(
            color               = color,
            size                = size,
            gender              = gender,
            brand               = brand,
            style               = style,
            condition_preferred = cond_soft,
        )

        # C. Keyword extraction (KeyBERT)
        try:
            keywords, keyword_scores = extract_keywords(normalized, top_n=self.kw_top_n)
        except Exception:
            logger.exception("KeyBERT extraction failed; using empty keywords")
            keywords, keyword_scores = [], {}

        # Enriched query: structured fields dominate, keywords supplement.
        # Order: product_type > brand > gender > color > size > style > keywords
        # Skip any structured value already present verbatim in normalized query.
        structured_parts: list[str] = []
        for val in [
            product_type.normalized if product_type else None,
            brand.normalized        if brand        else None,
            gender.normalized       if gender       else None,
            color.normalized        if color        else None,
            size.normalized         if size         else None,
            style.normalized        if style        else None,
        ]:
            if val and str(val).lower() not in normalized:
                structured_parts.append(str(val))

        # Append top-2 keywords only if they add new content
        all_added = set(structured_parts) | {normalized}
        kw_supplement = [
            kw for kw in keywords[:2]
            if kw not in all_added and kw not in normalized
        ]
        enriched_parts = [normalized] + structured_parts + kw_supplement
        enriched       = " ".join(enriched_parts)

        # D. Category classification (learned)
        routing = CategoryRouting()
        if self.classifier is not None and self.embed_fn is not None:
            try:
                routing = self._predict_category(enriched)
            except Exception:
                logger.exception("CategoryClassifier failed; routing to full index")

        return ParsedQuery(
            raw_query        = raw_query,
            normalized_query = normalized,
            product_type     = product_type,
            keywords         = keywords,
            keyword_scores   = keyword_scores,
            hard             = hard,
            soft             = soft,
            intent           = "buy",
            urgency          = urgency,
            routing          = routing,
            enriched_query   = enriched,
        )

    @torch.no_grad()
    def _predict_category(self, text: str, top_k: int = 2) -> CategoryRouting:
        emb    = self.embed_fn([text])                     # (1, D)
        logits = self.classifier(emb.to(self.device))
        probs  = F.softmax(logits, dim=-1)[0]

        top_k = min(top_k, len(CATEGORIES))
        vals, idxs = probs.topk(top_k)
        candidates = [
            (IDX2CAT[i.item()], round(v.item(), 4))
            for v, i in zip(vals, idxs)
            if v.item() >= 0.10
        ]
        return CategoryRouting(candidates=candidates)
