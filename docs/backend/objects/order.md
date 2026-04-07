# Object: Order

> Table: `orders`
> Formal agreement record created automatically when an OrderRequest is completed (both parties fill their info).
> No in-platform payment — physical exchange tracked via mutual confirmation.

---

## Fields

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| offerId | String | FK → Offer, unique (auto-created) |
| matchId | String | FK → Match |
| buyerUserId | String | FK → User |
| sellerUserId | String | FK → User |
| quantity | Int | |
| finalPrice | Decimal | Agreed price (from seller info) |
| fulfillmentMethod | String | pickup / delivery / flexible |
| meetupDetails | String? | Location + time instructions |
| proofSnapshot | Json? | Snapshot of listing proof at order creation |
| status | OrderStatus | see below |
| buyerConfirmedComplete | Boolean | Buyer clicked "Xác nhận hoàn thành" |
| sellerConfirmedComplete | Boolean | Seller clicked "Xác nhận hoàn thành" |
| completedAt | DateTime? | Set when both sides confirm |
| createdAt | DateTime | |
| cancelledAt | DateTime? | |
| cancellationReason | String? | |

---

## How Orders Are Created

Orders are **not** created by a direct API call. They are created automatically by `finalizeOrder()` inside `conversations.service.ts` when the `OrderRequest` is completed (both seller and buyer have filled their information).

The flow:
1. Either party initiates an `OrderRequest` in the conversation
2. The other party accepts it
3. Seller fills price + quantity → `OrderRequest.status = seller_filled`
4. Buyer fills phone + email + address + fulfillment method → `OrderRequest.status = buyer_filled`
5. When both sides are filled, `finalizeOrder()` atomically:
   - Creates an `Offer` (auto-accepted)
   - Creates the `Order` linked to that `Offer`
   - Emits `order_created` WebSocket event in the `/chat` namespace
   - Sends in-app notifications to both parties

---

## State Machine

```
created
  ├─ one side confirms  → in_progress
  └─ cancel             → cancelled

in_progress
  ├─ both confirm       → completed
  └─ cancel             → cancelled

completed
  └─ dispute (within 48h) → disputed

cancelled  (terminal)
disputed   (terminal for order updates)
```

---

## Completion Logic

Both sides must independently confirm. Each confirmation is tracked separately:

```typescript
// POST /api/orders/:id/confirm
if (isBuyer)  data.buyerConfirmedComplete  = true
if (isSeller) data.sellerConfirmedComplete = true

if (newBuyer && newSeller) {
  data.status      = 'completed'
  data.completedAt = new Date()
}
```

After each confirmation, `order_updated` is emitted via the `/orders` WebSocket namespace to both parties.

---

## Realtime (WebSocket)

**Namespace:** `/orders`

**Auth:** Same ws-token pattern as `/chat`.

| Event | Direction | Description |
|-------|-----------|-------------|
| `join_order` | client → server | Join room for this order |
| `order_updated` | server → client | Status changed (confirm, cancel, dispute) |

Frontend hook: `hooks/useOrderSocket.ts`

---

## Post-Completion Actions

When `status = completed`:
1. Both parties receive `order_completed` in-app notification
2. 7-day window opens for RatingReview submission
3. 48-hour window opens for Dispute filing

Rating updates: after each review, `sellerProfile.sellerRating` or `buyerProfile.buyerRating` is recalculated as the average of all reviews received.

---

## Business Rules

| Rule | Description |
|------|-------------|
| R-O1 | Order auto-created when OrderRequest is completed (both sides filled) |
| R-OR1 | Dispute must be filed within 48 hours of `completedAt` |
| R-OR2 | RatingReview window: 7 days from `completedAt` |
| R-OR3 | One RatingReview per role per order (buyer reviews seller, seller reviews buyer) |
| R-OR4 | Cancellation reason required |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/orders` | List my orders (as buyer + seller) |
| GET | `/api/orders/:id` | Order detail + reviews + dispute |
| POST | `/api/orders/:id/confirm` | Mark your side as complete |
| POST | `/api/orders/:id/cancel` | Cancel (with reason) |
| POST | `/api/orders/:id/dispute` | File dispute (within 48h of completion) |
| POST | `/api/orders/:id/review` | Submit rating review |

---

## Related Objects

- [conversation.md](conversation.md) — OrderRequest created here leads to this Order
- [dispute.md](dispute.md) — Can be filed on this order
- [notification.md](notification.md) — Both sides notified on status changes
