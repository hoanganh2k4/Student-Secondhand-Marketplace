# Object: ProductListing

> Table: `product_listings`
> A seller's offer to sell a specific item, with proof assets attached.

---

## Fields

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| sellerProfileId | String | FK → SellerProfile |
| title | String | |
| categoryId | String | FK → Category |
| subcategoryId | String? | FK → Category (sub) |
| description | String? | |
| condition | `poor \| fair \| good \| very_good \| like_new` | required |
| conditionNotes | String? | e.g., "minor scratch on back" |
| quantityAvailable | Int | original stock |
| quantityRemaining | Int | decremented as orders confirm |
| priceExpectation | Decimal | asking price |
| priceFlexible | Boolean | whether price is negotiable |
| location | String? | Campus zone |
| availabilityWindow | String? | e.g., "weekday evenings" |
| status | ListingStatus | see state machine below |
| proofCompletenessScore | Int | 0–100, updated on each upload |
| expiresAt | DateTime | default: 30 days |
| createdAt | DateTime | |

---

## State Machine

```
draft → active → matched → in_conversation → in_negotiation
                         ↘                                  ↘
                    partially_sold                          sold
                    expired / removed
```

| Status | Meaning |
|--------|---------|
| `draft` | Created, not yet published |
| `active` | Published, visible to matching engine |
| `matched` | At least one Match proposed |
| `in_conversation` | At least one Conversation opened |
| `partially_sold` | Some quantity sold, more remaining |
| `sold` | `quantityRemaining = 0` |
| `expired` | Past `expiresAt` |
| `removed` | Admin or seller removed |

---

## Proof Requirements

Listings must meet the category's `proofRequirements` before publishing.
`proofCompletenessScore` must be ≥ 60 to call `/api/listings/[id]/publish`.

Minimum proof by category:
- Electronics: 3 photos (item, serial number, power-on), 1 video demo
- Textbooks: 2 photos (cover, ISBN), condition note
- Clothing: 2 photos (front, tag/label)
- Other: 1 photo minimum

---

## Business Rules

| Rule | Description |
|------|-------------|
| R-L1 | Cannot publish without meeting category proof requirements |
| R-L2 | Matching runs automatically when status transitions to `active` |
| R-L3 | `quantityRemaining` decremented only when an Order completes |
| R-L4 | `status = partially_sold` when some but not all quantity sold |
| R-L5 | Auto-expires after 30 days; cron sets `expired` |
| R-L6 | Seller can re-activate an `expired` listing (resets `expiresAt`) |
| R-L7 | Cannot edit after `active` (requires re-draft) |

---

## Related API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/listings` | Create (draft) |
| PATCH | `/api/listings/[id]` | Update (draft only) |
| POST | `/api/listings/[id]/publish` | Draft → active |
| DELETE | `/api/listings/[id]` | Remove |
| POST | `/api/upload` | Attach ProofAsset |

---

## Related Objects

- [proof-asset.md](proof-asset.md) — Photos/videos attached to this listing
- [match.md](match.md) — Matches created against this listing
- [user.md](user.md) — SellerProfile owner
- [demand-request.md](demand-request.md) — Matched against demands
