# Object: Offer

> Table: `offers`
> A formal proposal to transact at specific price and terms.
> Only one active offer per conversation at a time.

---

## Fields

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| conversationId | String | FK → Conversation |
| createdByUserId | String | FK → User |
| matchId | String | FK → Match |
| quantity | Int | Units to purchase |
| proposedPrice | Decimal | Per unit |
| totalPrice | Decimal | quantity × proposedPrice |
| fulfillmentMethod | `pickup \| delivery \| flexible` | |
| meetupLocation | String? | |
| meetupTime | DateTime? | |
| termsNotes | String? | Additional conditions |
| proofSnapshot | JSON? | Snapshot of ProofAssets at time of offer |
| parentOfferId | String? | FK → Offer (for counter-offer chains) |
| counterOfferId | String? | FK → Offer (child counter-offer) |
| status | OfferStatus | see below |
| expiresAt | DateTime | default: 48 hours |
| createdAt | DateTime | |

---

## State Machine

```
draft → pending → accepted → (Order created)
              ↘ rejected
              ↘ countered → (new Offer as counter)
              ↘ expired
cancelled (creator only, before response)
```

| Status | Meaning |
|--------|---------|
| `draft` | Not yet sent |
| `pending` | Sent to recipient, awaiting response |
| `countered` | Recipient created a counter-offer |
| `accepted` | Recipient accepted; Order created atomically |
| `rejected` | Recipient rejected |
| `expired` | Not acted on within 48 hours |
| `cancelled` | Creator cancelled before response |

---

## Proof Snapshot

When an offer is accepted and an Order is created, the current state of all ProofAssets for the listing is snapshotted into `proofSnapshot`. This creates an immutable record of what was shown at time of deal — used for dispute resolution.

```json
{
  "snapshotAt": "2026-04-04T10:00:00Z",
  "assets": [
    { "id": "...", "fileUrl": "...", "assetType": "photo", "qualityScore": 85 }
  ]
}
```

---

## Counter-Offer Chain

Offers link to each other via `parentOfferId`:
```
Offer A (pending) → countered → Offer B (pending, parentOfferId=A) → accepted
```

---

## Business Rules

| Rule | Description |
|------|-------------|
| R-O1 | Offers only createable when `Conversation.stage = negotiation` |
| R-O2 | Only one active (pending) Offer per Conversation |
| R-O3 | Default expiry: 48 hours |
| R-O4 | Accepting an offer creates Order atomically (DB transaction) |
| R-O5 | Creator can cancel only before recipient responds |
| R-O6 | Counter-offer moves original to `countered` status |

---

## Related API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/conversations/[id]/offers` | Create offer |
| GET | `/api/offers/[id]` | Get offer detail |
| POST | `/api/offers/[id]/accept` | Accept → creates Order |
| POST | `/api/offers/[id]/reject` | Reject |
| POST | `/api/offers/[id]/counter` | Counter-offer |
| DELETE | `/api/offers/[id]` | Cancel (creator only) |

---

## Related Objects

- [conversation.md](conversation.md) — Parent
- [order.md](order.md) — Created on accept
- [match.md](match.md) — Match context
