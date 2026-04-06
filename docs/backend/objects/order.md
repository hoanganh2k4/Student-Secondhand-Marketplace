# Object: Order

> Table: `orders`
> Formal agreement record created when an Offer is accepted.
> No in-platform payment — physical exchange tracked via mutual confirmation.

---

## Fields

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| offerId | String | FK → Offer, unique |
| matchId | String | FK → Match |
| buyerUserId | String | FK → User |
| sellerUserId | String | FK → User |
| quantity | Int | |
| finalPrice | Decimal | Per unit agreed price |
| fulfillmentMethod | String | pickup / delivery / flexible |
| meetupDetails | String? | Location + time instructions |
| proofSnapshot | JSON? | Snapshot of listing proof at offer acceptance |
| status | OrderStatus | see below |
| buyerConfirmedComplete | Boolean | Buyer clicked "I received it" |
| sellerConfirmedComplete | Boolean | Seller clicked "I handed it over" |
| completedAt | DateTime? | Set when both sides confirm |
| createdAt | DateTime | |
| cancelledAt | DateTime? | |
| cancellationReason | String? | |

---

## State Machine

```
created → confirmed → in_progress → completed
        ↘                          ↘ cancelled
                                    ↘ disputed
```

| Status | Meaning |
|--------|---------|
| `created` | Offer accepted, order exists |
| `confirmed` | Both parties confirmed meeting plan |
| `in_progress` | Meetup scheduled / delivery in transit |
| `completed` | Both `buyerConfirmedComplete` and `sellerConfirmedComplete` = true |
| `cancelled` | Cancelled before completion |
| `disputed` | Dispute filed (within 48h of completion) |

---

## Completion Logic

Both sides must confirm independently:
```typescript
// PATCH /api/orders/[id]/confirm
if (user.id === order.buyerUserId) order.buyerConfirmedComplete = true
if (user.id === order.sellerUserId) order.sellerConfirmedComplete = true

if (order.buyerConfirmedComplete && order.sellerConfirmedComplete) {
  order.status = 'completed'
  order.completedAt = new Date()
  // Triggers: quantity decrement on listing, demand fulfilled check, rating window opens
}
```

---

## Post-Completion Triggers

When `status = completed`:
1. `ProductListing.quantityRemaining` decremented
2. If `listing.quantityRemaining = 0` → `listing.status = sold`
3. If `demand.fulfilledQuantity >= demand.quantityNeeded` → `demand.status = fulfilled`
4. 7-day window opens for RatingReview submission
5. 48-hour window opens for Dispute filing

---

## Business Rules

| Rule | Description |
|------|-------------|
| R-O4 | Order created atomically when Offer is accepted |
| R-OR1 | Dispute must be filed within 48 hours of `completedAt` |
| R-OR2 | RatingReview window: 7 days from `completedAt` |
| R-OR3 | One RatingReview per role per order (buyer reviews seller, seller reviews buyer) |
| R-OR4 | Cancellation reason required |

---

## Related API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/orders` | List my orders |
| GET | `/api/orders/[id]` | Order detail + proof snapshot |
| POST | `/api/orders/[id]/confirm` | Mark completion |
| POST | `/api/orders/[id]/cancel` | Cancel |
| POST | `/api/orders/[id]/dispute` | File dispute |
| POST | `/api/orders/[id]/review` | Submit rating |

---

## Related Objects

- [offer.md](offer.md) — Source offer
- [dispute.md](dispute.md) — Can be filed on this order
- [notification.md](notification.md) — Both sides notified on status changes
