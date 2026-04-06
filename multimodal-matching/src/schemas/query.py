"""
src/schemas/query.py

ParsedQuery — contract giữa Stage 0 và tất cả stages sau.

Triết lý thiết kế:
  - HardConstraints: vi phạm → penalise nặng hoặc loại
  - SoftPreferences: không khớp → trừ điểm, vẫn hiện
  - RawSpan: mỗi giá trị giữ cả raw text và normalized value
  - Null thật sự khi không tìm thấy — không đoán bừa

Ví dụ:
    hard.price.max = RawSpan(raw="dưới 300k",  normalized=300_000.0)  → hard
    soft.style     = RawSpan(raw="bomber",      normalized="bomber")   → soft
    soft.color     = RawSpan(raw="đen",         normalized="black")    → soft
    soft.size      = None                                              → không biết
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


# ── Primitive: giá trị trích xuất có raw span ──────────────────────────────────

@dataclass
class RawSpan:
    """
    Một giá trị được trích xuất từ query.

    raw:        đúng text trong query, không sửa   ("đen", "dưới 300k", "size L")
    normalized: giá trị chuẩn hoá                  ("black", 300_000.0, "L")
    confidence: độ tin cậy của việc trích xuất     (1.0 = rule-based chắc chắn)
    """
    raw:        str
    normalized: Any          # str | float | int — tuỳ thuộc vào loại giá trị
    confidence: float = 1.0

    def __repr__(self) -> str:
        return f"RawSpan({self.raw!r} → {self.normalized!r}, conf={self.confidence:.2f})"


# ── Hard Constraints ────────────────────────────────────────────────────────────

@dataclass
class PriceRange:
    """
    Khoảng giá từ query.

    Semantic:
        min = None  → không có chặn dưới
        max = None  → không có chặn trên
        cả hai None → không đề cập giá

    Unit: VND (đã quy đổi trong normalized).
    """
    min: RawSpan | None = None   # raw="từ 3 triệu",   normalized=3_000_000.0
    max: RawSpan | None = None   # raw="dưới 300k",    normalized=300_000.0

    @property
    def min_value(self) -> float | None:
        return float(self.min.normalized) if self.min is not None else None

    @property
    def max_value(self) -> float | None:
        return float(self.max.normalized) if self.max is not None else None

    def is_empty(self) -> bool:
        return self.min is None and self.max is None


@dataclass
class HardConstraints:
    """
    Constraints mà nếu vi phạm → sản phẩm bị penalise nặng.

    Nguyên tắc: đây là những điều buyer NÓ RÕ RÀNG.
    Ví dụ: "dưới 300k" → price_max là hard.
    """
    price:           PriceRange  = field(default_factory=PriceRange)
    condition_floor: RawSpan | None = None
    # raw="còn mới",  normalized="like_new"
    # Ý nghĩa: sản phẩm phải có condition ≥ condition_floor


# ── Soft Preferences ───────────────────────────────────────────────────────────

@dataclass
class SoftPreferences:
    """
    Preferences mà nếu không khớp → trừ điểm, không loại.

    Nguyên tắc: đây là những thuộc tính MUỐN CÓ nhưng không phải điều kiện cứng.
    Ví dụ: color, size, style, gender — buyer vẫn muốn xem nếu không có.

    Mỗi field là RawSpan hoặc None (không bao giờ đoán bừa).
    """
    color:               RawSpan | None = None   # raw="đen",     normalized="black"
    size:                RawSpan | None = None   # raw="size L",  normalized="L"
    gender:              RawSpan | None = None   # raw="nữ",      normalized="female"
    brand:               RawSpan | None = None   # raw="Nike",    normalized="nike"
    style:               RawSpan | None = None   # raw="bomber",  normalized="bomber"
    material:            RawSpan | None = None   # raw="cotton",  normalized="cotton"
    condition_preferred: RawSpan | None = None   # raw="như mới", normalized="like_new"
    # Khác với condition_floor (hard): đây là preference, sản phẩm worse vẫn hiện


# ── Category Routing ────────────────────────────────────────────────────────────

@dataclass
class CategoryRouting:
    """
    Kết quả category prediction từ Stage 0.

    candidates: list[(category, confidence)] sorted by confidence desc.
    Nếu empty → không đủ confidence → fallback to full index.
    """
    candidates: list[tuple[str, float]] = field(default_factory=list)

    @property
    def top_category(self) -> str | None:
        return self.candidates[0][0] if self.candidates else None

    @property
    def top_confidence(self) -> float:
        return self.candidates[0][1] if self.candidates else 0.0

    @property
    def category_hints(self) -> list[str]:
        return [cat for cat, _ in self.candidates]

    def is_confident(self, threshold: float = 0.35) -> bool:
        return self.top_confidence >= threshold


# ── ParsedQuery ─────────────────────────────────────────────────────────────────

@dataclass
class ParsedQuery:
    """
    Output của Stage 0 — contract với tất cả stages sau.

    Nguyên tắc:
      - Null thật sự khi không tìm thấy (không default bừa)
      - Raw span luôn đi kèm normalized value
      - Hard vs soft phân biệt rõ
      - Backward-compat properties để stage1/stage3 không cần sửa
    """

    # ── Input ────────────────────────────────────────────────────────────────
    raw_query:        str
    normalized_query: str

    # ── Product focus ─────────────────────────────────────────────────────────
    product_type: RawSpan | None = None
    # raw="áo khoác", normalized="jacket" | None nếu không rõ

    # ── Semantic keywords (KeyBERT) ───────────────────────────────────────────
    keywords:       list[str]             = field(default_factory=list)
    keyword_scores: dict[str, float]      = field(default_factory=dict)

    # ── Constraints & Preferences ─────────────────────────────────────────────
    hard: HardConstraints  = field(default_factory=HardConstraints)
    soft: SoftPreferences  = field(default_factory=SoftPreferences)

    # ── Signals ───────────────────────────────────────────────────────────────
    intent:  str = "buy"    # "buy" | "browse" — currently rule-based
    urgency: str = "low"    # "high" | "medium" | "low"

    # ── Category routing ──────────────────────────────────────────────────────
    routing: CategoryRouting = field(default_factory=CategoryRouting)

    # ── Embedding input ───────────────────────────────────────────────────────
    enriched_query: str = ""
    # = normalized_query + top keywords — dùng cho dense retrieval

    # ── Backward-compat properties (stage1, stage3 không cần sửa) ────────────

    @property
    def price_max(self) -> float | None:
        return self.hard.price.max_value

    @property
    def price_min(self) -> float | None:
        return self.hard.price.min_value

    @property
    def condition(self) -> str | None:
        """
        Returns condition label đang được require/prefer.
        Hard floor có priority; soft preferred là fallback.
        """
        if self.hard.condition_floor is not None:
            return str(self.hard.condition_floor.normalized)
        if self.soft.condition_preferred is not None:
            return str(self.soft.condition_preferred.normalized)
        return None

    @property
    def top_categories(self) -> list[tuple[str, float]]:
        """Compat với stage1 cũ đọc parsed.top_categories."""
        return self.routing.candidates

    @property
    def category_hints(self) -> list[str]:
        """Compat với stage1 cũ đọc parsed.category_hints."""
        return self.routing.category_hints

    @property
    def top_category(self) -> str | None:
        return self.routing.top_category

    # ── Serialization ─────────────────────────────────────────────────────────

    def to_dict(self) -> dict[str, Any]:
        def span_dict(s: RawSpan | None) -> dict | None:
            if s is None:
                return None
            return {"raw": s.raw, "normalized": s.normalized, "confidence": s.confidence}

        return {
            "raw_query":        self.raw_query,
            "normalized_query": self.normalized_query,
            "product_type":     span_dict(self.product_type),
            "keywords":         self.keywords,
            "keyword_scores":   self.keyword_scores,
            "intent":           self.intent,
            "urgency":          self.urgency,
            "hard_constraints": {
                "price": {
                    "min": span_dict(self.hard.price.min),
                    "max": span_dict(self.hard.price.max),
                },
                "condition_floor": span_dict(self.hard.condition_floor),
            },
            "soft_preferences": {
                "color":               span_dict(self.soft.color),
                "size":                span_dict(self.soft.size),
                "gender":              span_dict(self.soft.gender),
                "brand":               span_dict(self.soft.brand),
                "style":               span_dict(self.soft.style),
                "material":            span_dict(self.soft.material),
                "condition_preferred": span_dict(self.soft.condition_preferred),
            },
            "routing": {
                "candidates":    self.routing.candidates,
                "top_category":  self.routing.top_category,
                "confident":     self.routing.is_confident(),
            },
            "enriched_query": self.enriched_query,
        }
