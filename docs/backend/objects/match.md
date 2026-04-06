# Object: Match

> Table: `matches`
> System-created link between a DemandRequest and a ProductListing based on matching engine output.
> Unique constraint: `(demandRequestId, productListingId)`

---

## Fields

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| demandRequestId | String | FK → DemandRequest |
| productListingId | String | FK → ProductListing |
| matchScore | Int | 0–100, computed by engine |
| matchConfidence | `high \| medium \| low` | derived from score |
| scoreBreakdown | JSON | per-dimension scores |
| missingInfoFlags | String[] | e.g., `["price_mismatch", "insufficient_proof"]` |
| status | MatchStatus | see state machine below |
| buyerAcknowledged | Boolean | buyer saw this match |
| sellerAcknowledged | Boolean | seller saw this match |
| createdAt | DateTime | |

---

## Score Breakdown Shape

```json
{
  "category":  85,
  "price":     72,
  "condition": 60,
  "location":  50,
  "quantity":  100,
  "semantic":  78
}
```

Weights: category=25, price=22, condition=17, location=13, quantity=8, semantic=15.
See [../services/matching-engine.md](../services/matching-engine.md).

---

## Confidence Thresholds

| Score | Confidence | Auto-open conversation? |
|-------|-----------|------------------------|
| 80–100 | `high` | Yes, after 24h if neither declines |
| 60–79 | `medium` | Only after both sides explicitly accept |
| 40–59 | `low` | Only after both sides explicitly confirm |
| < 40 | — | Not created |

---

## State Machine

```
proposed → buyer_confirmed → active → closed_success
         ↘ seller_confirmed ↗        ↘ closed_failed
         ↘                            ↘ expired
           (either declines)
```

| Status | Meaning |
|--------|---------|
| `proposed` | Created by engine, neither party acknowledged |
| `buyer_confirmed` | Buyer acknowledged |
| `seller_confirmed` | Seller acknowledged |
| `active` | Both confirmed, Conversation can open |
| `closed_success` | Order completed |
| `closed_failed` | Conversation closed without order |
| `expired` | Match not acted on within window |

---

## Missing Info Flags

| Flag | Meaning |
|------|---------|
| `price_mismatch` | Listing price outside buyer budget |
| `condition_below_requirement` | Listing condition below preferred |
| `location_incompatible` | Different campus zone |
| `quantity_partial` | Listing quantity < demand quantity |
| `category_approximate` | Different subcategory, same parent |
| `insufficient_proof` | `proofCompletenessScore < 60` |

---

## Related API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/matches/[id]` | Get match + breakdown |
| POST | `/api/matches/[id]/acknowledge` | Mark acknowledged |
| POST | `/api/matches/[id]/decline` | Decline match |

---

## Related Objects

- [demand-request.md](demand-request.md)
- [product-listing.md](product-listing.md)
- [conversation.md](conversation.md) — Opens from this match
- [offer.md](offer.md) — Created within this match's conversation
