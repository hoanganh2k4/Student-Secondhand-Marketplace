# Object: DemandRequest

> Table: `demand_requests`
> A buyer's structured intent to purchase a specific item.

---

## Fields

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| buyerProfileId | String | FK → BuyerProfile |
| title | String | 3–120 chars |
| categoryId | String | FK → Category |
| subcategoryId | String? | FK → Category (sub) |
| description | String? | Free text, max 1000 |
| budgetMin | Decimal | |
| budgetMax | Decimal | ≥ budgetMin |
| preferredCondition | `poor \| fair \| good \| very_good \| like_new` | default: `good` |
| quantityNeeded | Int | default: 1 |
| fulfilledQuantity | Int | updated as orders complete |
| location | String? | Campus zone |
| urgency | `flexible \| within_week \| within_month` | |
| specialRequirements | String? | Free text, max 500 |
| status | DemandStatus | see state machine below |
| expiresAt | DateTime | default: 30 days from creation |
| createdAt | DateTime | |

---

## State Machine

```
draft → active → waiting
                       ↘
               active → matched → in_conversation → in_negotiation → fulfilled
                                                                    ↘
                                                              expired / cancelled
```

| Status | Meaning |
|--------|---------|
| `draft` | Created, not yet submitted |
| `active` | Live, matching in progress |
| `waiting` | Active but no matches found yet |
| `matched` | At least one Match proposed |
| `in_conversation` | At least one Conversation opened |
| `in_negotiation` | At least one Conversation in negotiation stage |
| `fulfilled` | `fulfilledQuantity >= quantityNeeded` |
| `expired` | Past `expiresAt` |
| `cancelled` | Cancelled by buyer |

See [../state-machines.md](../state-machines.md) for full transition code.

---

## Business Rules

| Rule | Description |
|------|-------------|
| R-D1 | Max 10 active (non-expired, non-cancelled, non-fulfilled) demands per buyer |
| R-D2 | `budgetMin <= budgetMax` (enforced by Zod + DB constraint) |
| R-D3 | Matching runs automatically on `active` status |
| R-D4 | Cannot be edited after status leaves `draft` |
| R-D5 | Auto-expires after 30 days; cron job sets status to `expired` |

---

## Matching

When a DemandRequest reaches `active`:
1. Rule-based engine scores against active ProductListings (category, price, condition, location)
2. AI service (`POST /search`) returns semantically similar products
3. Results merged; Match records created for score ≥ 40

---

## Related API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/demands` | Create + activate |
| GET | `/api/demands/[id]` | Get demand + matches |
| PATCH | `/api/demands/[id]` | Update (draft only) |
| DELETE | `/api/demands/[id]` | Cancel |

---

## Related Objects

- [match.md](match.md) — Matches created from this demand
- [user.md](user.md) — BuyerProfile owner
- [product-listing.md](product-listing.md) — Matched against listings
