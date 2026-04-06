"""
src/pipeline/stage3/__init__.py
Stage 3 — Intent-Aware Reranker

Điều chỉnh score dựa trên ParsedQuery.hard và ParsedQuery.soft:

  Hard constraints (từ parsed.hard):
    - price ceiling: sản phẩm vượt ngân sách → penalty nặng
    - condition_floor: sản phẩm tệ hơn yêu cầu tối thiểu → penalty nặng

  Soft preferences (từ parsed.soft) — GRADED, không binary:
    - condition_preferred: exact/adjacent/miss
    - color:  exact=1.0 / same family=0.5 / different=0.0
    - size:   exact=1.0 / adjacent=0.7 / miss=0.0
    - brand:  exact=1.0 / miss=0.0
    - gender: exact=1.0 / unisex compatible=0.7 / miss=0.0

  Diversity:
    - Giảm điểm listing trùng title để tránh top-10 là cùng 1 sản phẩm

  Explanation:
    - why_this_result: list[str] — human-readable reasons cho mỗi kết quả

Score pipeline:
  1. retrieval_score (FAISS+BM25 RRF)             — semantic + lexical
  2. × constraint_multiplier                      — hard violations → floor
  3. + graded_attribute_score × ATTR_WEIGHT       — structured field graded match
  4. - diversity_penalty                          — dedup
  5. → why_this_result                            — explanation
"""
from __future__ import annotations

from typing import Any

from src.schemas.query import ParsedQuery
from src.reranking import RerankerInference
from src.utils import get_logger

logger = get_logger(__name__)

_CONDITION_RANK = {
    "new_sealed": 5,
    "like_new":   4,
    "excellent":  3,
    "good":       2,
    "fair":       1,
}
_CONDITION_LABEL = {v: k for k, v in _CONDITION_RANK.items()}

_PRICE_HARD_TOLERANCE  = 0.15   # 15% vượt budget → penalty mạnh
_PRICE_UNDER_TOLERANCE = 0.15   # 15% dưới price_min → nhẹ tay hơn

# Attribute match scoring weights (must sum ≤ 1.0)
_ATTR_WEIGHT = 0.25   # max contribution to rerank_score
_ATTR_FIELD_WEIGHTS = {
    "color":        0.30,
    "size":         0.30,
    "brand":        0.25,
    "gender":       0.10,
    "product_type": 0.05,
}

# ── Graded match tables ────────────────────────────────────────────────────────

# Color families — same family = partial match (0.5)
_COLOR_FAMILIES: list[frozenset] = [
    frozenset({"black", "dark_gray", "charcoal"}),               # dark neutrals
    frozenset({"white", "cream", "beige", "ivory", "off_white"}),# light neutrals
    frozenset({"gray", "grey", "silver"}),                       # mid neutrals
    frozenset({"red", "crimson", "burgundy", "wine", "maroon"}), # red family
    frozenset({"blue", "navy", "sky_blue", "cobalt", "teal"}),   # blue family
    frozenset({"green", "olive", "khaki", "mint", "sage"}),      # green family
    frozenset({"pink", "rose", "coral", "salmon"}),              # pink family
    frozenset({"yellow", "gold", "mustard", "orange", "amber"}), # warm
    frozenset({"brown", "tan", "caramel", "chocolate"}),         # brown family
    frozenset({"purple", "violet", "lavender", "lilac"}),        # purple family
]

_COLOR_FAMILY_MAP: dict[str, frozenset] = {}
for _fam in _COLOR_FAMILIES:
    for _c in _fam:
        _COLOR_FAMILY_MAP[_c] = _fam


def _color_match(query_color: str, product_color: str | None) -> float:
    """
    Graded color match:
      exact → 1.0
      same color family → 0.5
      different → 0.0
      product_color is None → 0.0 (unknown)
    """
    if product_color is None:
        return 0.0
    q = query_color.lower()
    p = product_color.lower()
    if q == p:
        return 1.0
    q_fam = _COLOR_FAMILY_MAP.get(q)
    p_fam = _COLOR_FAMILY_MAP.get(p)
    if q_fam and p_fam and q_fam == p_fam:
        return 0.5
    return 0.0


# Size adjacency — adjacent sizes = partial match (0.7)
_SIZE_ADJACENT: dict[str, set[str]] = {
    "XS":  {"S"},
    "S":   {"XS", "M"},
    "M":   {"S", "L"},
    "L":   {"M", "XL"},
    "XL":  {"L", "XXL"},
    "XXL": {"XL", "XXXL"},
    "XXXL":{"XXL"},
}


def _size_match(query_size: str, product_size: str | None) -> float:
    """
    Graded size match:
      exact → 1.0
      adjacent → 0.7
      miss → 0.0
    """
    if product_size is None:
        return 0.0
    q = query_size.upper()
    p = product_size.upper()
    if q == p:
        return 1.0
    if p in _SIZE_ADJACENT.get(q, set()):
        return 0.7
    # Numeric sizes: ±1 = adjacent
    try:
        qi, pi = int(q), int(p)
        if abs(qi - pi) == 1:
            return 0.7
        if abs(qi - pi) == 0:
            return 1.0
    except ValueError:
        pass
    return 0.0


def _gender_match(query_gender: str, product_gender: str | None) -> float:
    """
    Graded gender match:
      exact → 1.0
      unisex (product) → 0.7  (unisex fits everyone)
      miss → 0.0
    """
    if product_gender is None:
        return 0.0
    q = query_gender.lower()
    p = product_gender.lower()
    if q == p:
        return 1.0
    if p == "unisex":
        return 0.7
    return 0.0


def _exact_match(q_val: str, p_val: str | None) -> float:
    """Binary match for brand and product_type."""
    if p_val is None:
        return 0.0
    return 1.0 if q_val.lower() == p_val.lower() else 0.0


_FIELD_MATCH_FN = {
    "color":        _color_match,
    "size":         _size_match,
    "gender":       _gender_match,
    "brand":        _exact_match,
    "product_type": _exact_match,
}


class IntentAwareReranker:
    """
    Wraps RerankerInference, điều chỉnh score theo hard constraints và soft preferences.

    Hard constraint vi phạm → nhân hệ số penalty thấp (sản phẩm xuống cuối, không loại hẳn).
    Soft preference không khớp → graded score adjustment.
    Explanation → why_this_result per candidate.
    """

    def __init__(
        self,
        reranker:             RerankerInference | None,
        enable_price_filter:  bool = True,
        enable_condition_adj: bool = True,
        enable_diversity:     bool = True,
    ):
        self.reranker             = reranker
        self.enable_price_filter  = enable_price_filter
        self.enable_condition_adj = enable_condition_adj
        self.enable_diversity     = enable_diversity

    def rerank(
        self,
        query:           str,
        candidates:      list[dict[str, Any]],
        parsed:          ParsedQuery,
        top_k:           int = 10,
        image_transform  = None,
    ) -> list[dict[str, Any]]:
        if not candidates:
            return []

        # Neural reranker (nếu có checkpoint)
        if self.reranker:
            candidates = self.reranker.rerank(
                query, candidates, top_k=len(candidates), image_transform=image_transform
            )
        else:
            for c in candidates:
                c["rerank_score"] = c.get("retrieval_score", 0.0)

        # Hard constraint: price
        if self.enable_price_filter:
            candidates = self._apply_price_hard(candidates, parsed)

        # Hard constraint: condition_floor + Soft: condition_preferred
        if self.enable_condition_adj:
            candidates = self._apply_condition(candidates, parsed)

        # Graded attribute match score
        candidates = self._apply_attribute_score(candidates, parsed)

        # Diversity
        if self.enable_diversity:
            candidates = self._apply_diversity(candidates)

        candidates.sort(key=lambda c: c["rerank_score"], reverse=True)

        # Build intent_signals + why_this_result
        for c in candidates:
            price_ok      = c.pop("_price_ok",        True)
            price_penalty = c.pop("_price_penalty",    0.0)
            condition_adj = c.pop("_condition_adj",    0.0)
            attr_score    = c.pop("_attribute_score",  0.0)
            attr_degrees  = c.pop("_attribute_degrees",{})
            diversity_pen = c.pop("_diversity_pen",    0.0)
            hard_violated = c.pop("_hard_violated",    False)

            c["intent_signals"] = {
                "price_ok":        price_ok,
                "price_penalty":   price_penalty,
                "condition_adj":   condition_adj,
                "attribute_score": attr_score,
                "attribute_hits":  {k: round(v, 2) for k, v in attr_degrees.items()},
                "diversity_pen":   diversity_pen,
                "hard_violated":   hard_violated,
            }
            c["why_this_result"] = self._explain(c, parsed, price_ok, price_penalty,
                                                  condition_adj, attr_degrees, hard_violated)

        return candidates[:top_k]

    # ── Hard: Price ───────────────────────────────────────────────────────────

    def _apply_price_hard(self, candidates: list[dict], parsed: ParsedQuery) -> list[dict]:
        price_max = parsed.hard.price.max_value
        price_min = parsed.hard.price.min_value

        for c in candidates:
            price    = c.get("metadata", {}).get("price")
            penalty  = 0.0
            ok       = True
            violated = False

            if price is not None and price_max is not None:
                if price > price_max * (1 + _PRICE_HARD_TOLERANCE):
                    multiplier = 0.25
                    c["rerank_score"] *= multiplier
                    penalty   = 1 - multiplier
                    ok        = False
                    violated  = True
                elif price > price_max:
                    over = (price - price_max) / price_max
                    multiplier = max(0.6, 1.0 - over * 4)
                    c["rerank_score"] *= multiplier
                    penalty = 1 - multiplier
                    ok      = False

            if price is not None and price_min is not None:
                floor = price_min * (1 - _PRICE_UNDER_TOLERANCE)
                if price < floor:
                    c["rerank_score"] *= 0.8
                    penalty = max(penalty, 0.2)
                    ok = False

            c["_price_ok"]      = ok
            c["_price_penalty"] = round(penalty, 3)
            c["_hard_violated"] = violated

        return candidates

    # ── Hard floor + Soft preferred: Condition ────────────────────────────────

    def _apply_condition(self, candidates: list[dict], parsed: ParsedQuery) -> list[dict]:
        hard_floor = parsed.hard.condition_floor
        soft_pref  = parsed.soft.condition_preferred

        if hard_floor is None and soft_pref is None:
            for c in candidates:
                c["_condition_adj"] = 0.0
                c["_hard_violated"] = c.get("_hard_violated", False)
            return candidates

        floor_rank = _CONDITION_RANK.get(str(hard_floor.normalized), 0) if hard_floor else 0
        pref_rank  = _CONDITION_RANK.get(str(soft_pref.normalized), 0) if soft_pref else 0

        for c in candidates:
            actual      = c.get("metadata", {}).get("condition", "good")
            actual_rank = _CONDITION_RANK.get(actual, 2)
            adj         = 0.0

            if hard_floor and actual_rank < floor_rank:
                diff = floor_rank - actual_rank
                multiplier = max(0.4, 1.0 - diff * 0.20)
                c["rerank_score"]  *= multiplier
                adj = -(1 - multiplier)
                c["_hard_violated"] = c.get("_hard_violated", False) or True

            elif soft_pref:
                diff = actual_rank - pref_rank
                if diff > 0:
                    adj = min(diff * 0.04, 0.10)
                elif diff < 0:
                    adj = max(diff * 0.05, -0.12)
                c["rerank_score"] = max(0.0, c["rerank_score"] + adj)

            c["_condition_adj"] = round(adj, 3)

        return candidates

    # ── Graded Attribute Match Scoring ────────────────────────────────────────

    def _apply_attribute_score(
        self, candidates: list[dict], parsed: ParsedQuery
    ) -> list[dict]:
        """
        Graded attribute match: color/size/gender/brand/product_type.

        Mỗi field trả về degree [0.0, 1.0] thay vì boolean:
          - color: exact=1.0, same family=0.5, miss=0.0
          - size:  exact=1.0, adjacent=0.7, miss=0.0
          - gender: exact=1.0, unisex=0.7, miss=0.0
          - brand, product_type: exact=1.0, miss=0.0

        attr_score = Σ (weight_i × degree_i) / Σ weight_i  (chỉ fields query có)
        contribution = attr_score × ATTR_WEIGHT added to rerank_score
        """
        query_attrs: dict[str, str] = {}
        if parsed.soft.color:
            query_attrs["color"]        = str(parsed.soft.color.normalized)
        if parsed.soft.size:
            query_attrs["size"]         = str(parsed.soft.size.normalized).upper()
        if parsed.soft.brand:
            query_attrs["brand"]        = str(parsed.soft.brand.normalized).lower()
        if parsed.soft.gender:
            query_attrs["gender"]       = str(parsed.soft.gender.normalized)
        if parsed.product_type:
            query_attrs["product_type"] = str(parsed.product_type.normalized)

        if not query_attrs:
            for c in candidates:
                c["_attribute_score"]   = 0.0
                c["_attribute_degrees"] = {}
            return candidates

        total_weight = sum(
            _ATTR_FIELD_WEIGHTS.get(field, 0.0) for field in query_attrs
        )
        if total_weight <= 0:
            for c in candidates:
                c["_attribute_score"]   = 0.0
                c["_attribute_degrees"] = {}
            return candidates

        for c in candidates:
            prod_attrs = c.get("metadata", {}).get("attributes", {})
            degrees: dict[str, float] = {}
            score = 0.0

            for field, q_val in query_attrs.items():
                p_val   = prod_attrs.get(field)
                w       = _ATTR_FIELD_WEIGHTS.get(field, 0.0)
                fn      = _FIELD_MATCH_FN.get(field, _exact_match)
                degree  = fn(q_val, p_val)
                score  += w * degree
                degrees[field] = degree

            normalized_attr_score = score / total_weight
            contribution          = normalized_attr_score * _ATTR_WEIGHT

            c["rerank_score"]       = max(0.0, c["rerank_score"] + contribution)
            c["_attribute_score"]   = round(normalized_attr_score, 3)
            c["_attribute_degrees"] = degrees

        return candidates

    # ── Diversity ─────────────────────────────────────────────────────────────

    def _apply_diversity(self, candidates: list[dict]) -> list[dict]:
        title_count: dict[str, int] = {}
        for c in candidates:
            key = c.get("metadata", {}).get("title", "")[:40]
            title_count[key] = title_count.get(key, 0) + 1

        for c in candidates:
            key   = c.get("metadata", {}).get("title", "")[:40]
            count = title_count.get(key, 1)
            if count > 1:
                penalty = min((count - 1) * 0.10, 0.40)
                c["rerank_score"]   = max(0.0, c["rerank_score"] - penalty)
                c["_diversity_pen"] = penalty
                title_count[key]   -= 1
            else:
                c["_diversity_pen"] = 0.0

        return candidates

    # ── Explanation ───────────────────────────────────────────────────────────

    def _explain(
        self,
        candidate:     dict,
        parsed:        ParsedQuery,
        price_ok:      bool,
        price_penalty: float,
        condition_adj: float,
        attr_degrees:  dict[str, float],
        hard_violated: bool,
    ) -> list[str]:
        """
        Generate human-readable explanation for why this product was ranked here.
        """
        meta  = candidate.get("metadata", {})
        attrs = meta.get("attributes", {})
        reasons: list[str] = []

        # Price
        price     = meta.get("price")
        price_max = parsed.hard.price.max_value
        price_min = parsed.hard.price.min_value
        if price is not None:
            if price_max is not None and price <= price_max:
                reasons.append(f"price within budget ({int(price):,}đ ≤ {int(price_max):,}đ)")
            elif price_max is not None and not price_ok:
                reasons.append(f"price over budget ({int(price):,}đ > {int(price_max):,}đ, penalty={price_penalty:.0%})")
            elif price_min is not None and price >= price_min:
                reasons.append(f"price above minimum ({int(price):,}đ ≥ {int(price_min):,}đ)")

        # Condition
        condition = meta.get("condition")
        if condition:
            if hard_violated and parsed.hard.condition_floor:
                reasons.append(
                    f"condition below floor: {condition} < {parsed.hard.condition_floor.normalized}"
                )
            elif parsed.hard.condition_floor:
                reasons.append(f"condition meets floor: {condition} ≥ {parsed.hard.condition_floor.normalized}")
            elif parsed.soft.condition_preferred and condition_adj != 0:
                if condition_adj > 0:
                    reasons.append(f"condition better than preferred: {condition} > {parsed.soft.condition_preferred.normalized}")
                else:
                    reasons.append(f"condition below preferred: {condition} < {parsed.soft.condition_preferred.normalized}")

        # Attributes
        _DEGREE_LABELS = {1.0: "exact match", 0.7: "compatible", 0.5: "similar family"}
        for field, degree in attr_degrees.items():
            if degree <= 0:
                continue
            q_val = ""
            if field == "color" and parsed.soft.color:
                q_val = parsed.soft.color.raw
            elif field == "size" and parsed.soft.size:
                q_val = parsed.soft.size.raw
            elif field == "brand" and parsed.soft.brand:
                q_val = parsed.soft.brand.raw
            elif field == "gender" and parsed.soft.gender:
                q_val = parsed.soft.gender.raw
            elif field == "product_type" and parsed.product_type:
                q_val = parsed.product_type.raw

            label     = _DEGREE_LABELS.get(degree, f"partial ({degree:.1f})")
            prod_val  = attrs.get(field, "?")
            if degree == 1.0:
                reasons.append(f"match {field}={q_val}")
            else:
                reasons.append(f"{label} {field}: query={q_val}, product={prod_val}")

        if not reasons:
            reasons.append("semantic similarity")

        return reasons
