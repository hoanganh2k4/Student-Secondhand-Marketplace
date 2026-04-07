# State Machines

> State transitions are enforced in service methods before each DB write that changes status.
> Invalid transitions throw `UnprocessableEntityException` (HTTP 422).

---

## Pattern

Each service checks current status before updating. If the transition is invalid, it throws immediately.

```typescript
// Example pattern used across services
if (!['created', 'in_progress'].includes(order.status)) {
  throw new UnprocessableEntityException(`Cannot confirm order with status '${order.status}'.`)
}
```

---

## MatchStatus

```
proposed
  ├─ BUYER_ACK  → buyer_confirmed
  └─ SELLER_ACK → seller_confirmed

buyer_confirmed
  └─ SELLER_ACK → active

seller_confirmed
  └─ BUYER_ACK  → active

active
  ├─ ORDER_CREATED → closed_success
  └─ ABANDONED    → closed_failed

(any) → expired  (background job)
```

**Implementation:** `matches.service.ts` — `acknowledge()`

- If buyer acknowledges: sets `buyerAcknowledged = true`, status → `buyer_confirmed`
- If seller acknowledges: sets `sellerAcknowledged = true`, status → `seller_confirmed`
- If the other side already acknowledged: status → `active`, opens conversation

---

## ConversationStage

```
verification → clarification → negotiation → closed
```

| Stage | Description |
|-------|-------------|
| `verification` | Buyer reviews listing proof. Text chat is open. |
| `clarification` | Both parties clarify details. |
| `negotiation` | Price and logistics negotiation, OrderRequest can be initiated. |
| `closed` | Conversation ended (order created, abandoned, expired, or admin action) |

**Implementation:** `conversations.service.ts` — `advanceStage()`

- Advancing emits a system message via WebSocket
- Conversation auto-closes when `finalizeOrder()` completes (`closeReason: completed`)

---

## OrderRequestStatus

> In-chat two-step order creation flow. One `OrderRequest` per conversation at a time (no new one while one is `pending` or `accepted`).

```
pending
  ├─ accept  → accepted
  └─ reject  → rejected

accepted
  ├─ seller fills price/quantity → seller_filled
  └─ buyer fills phone/email/address/fulfillment → buyer_filled

seller_filled
  └─ buyer fills info → completed  (finalizeOrder runs)

buyer_filled
  └─ seller fills info → completed  (finalizeOrder runs)

rejected  (terminal)
```

**`finalizeOrder()` — runs atomically when both sides have filled their info:**
1. Creates an `Offer` record from seller info
2. Creates an `Order` record linked to the Offer
3. Sets `OrderRequest.orderId` and `OrderRequest.status = completed`
4. Closes the conversation (`status: closed`, `closeReason: completed`)
5. Emits `order_created` WebSocket event to both parties in the `/chat` namespace
6. Sends `order_created` in-app notifications to both parties

**API endpoints:**

| Method | Path | Who | Description |
|--------|------|-----|-------------|
| POST | `/conversations/:id/order-requests` | Either | Initiate order request |
| POST | `/conversations/order-requests/:requestId/accept` | Other party | Accept |
| POST | `/conversations/order-requests/:requestId/reject` | Other party | Reject |
| PATCH | `/conversations/order-requests/:requestId/seller-info` | Seller | Fill price + quantity |
| PATCH | `/conversations/order-requests/:requestId/buyer-info` | Buyer | Fill contact + fulfillment |

---

## OrderStatus

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

**Implementation:** `orders.service.ts` — `confirm()`

- Each confirmation sets `buyerConfirmedComplete` or `sellerConfirmedComplete`
- When both are true: `status = completed`, `completedAt = now()`
- After each action, emits `order_updated` WebSocket event via `/orders` namespace

---

## DemandStatus

```
draft → active → waiting → matched → in_conversation → in_negotiation → fulfilled
                                                                       ↘ expired
                                                                       ↘ cancelled
```

---

## ListingStatus

```
draft → active → matched → in_conversation → partially_sold → sold
                         ↘                 ↘ expired
                           expired           removed
```

---

## OfferStatus

> Offers are auto-created by `finalizeOrder()` — users don't interact with them directly via API.

```
draft → pending → accepted  (→ Order created)
               → rejected
               → countered
               → expired
               → cancelled
```

---

## EvidenceRequestStatus

```
pending → fulfilled
        → rejected
        → expired  (background job, 48h after dueAt)
```

---

## DisputeStatus

```
opened → under_review → resolved
                      → closed
```
