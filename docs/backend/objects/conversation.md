# Object: Conversation

> Tables: `conversations`, `messages`, `evidence_requests`, `order_requests`
> The realtime communication channel between buyer and seller for a Match.
> One conversation per match (unique constraint on `matchId`).

---

## Conversation

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| matchId | String | FK → Match, unique |
| buyerUserId | String | FK → User |
| sellerUserId | String | FK → User |
| stage | `verification \| clarification \| negotiation \| closed` | |
| stageEnteredAt | DateTime | When current stage was entered |
| lastActivityAt | DateTime | Updated on each message/action |
| autoCloseAt | DateTime | 7 days from `lastActivityAt` |
| status | `active \| closed` | |
| closeReason | `completed \| abandoned \| expired \| admin_closed`? | |

---

## Stage Flow

```
verification → clarification → negotiation → closed
```

| Stage | Description |
|-------|-------------|
| `verification` | Buyer reviews listing proof; both can chat freely |
| `clarification` | Buyers clarify details |
| `negotiation` | OrderRequest flow can be initiated |
| `closed` | Order created, abandoned, expired, or admin action |

> **Note:** Text messaging is enabled in all stages (including `verification`). The original restriction has been removed.

---

## Message

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| conversationId | String | FK → Conversation |
| senderUserId | String | FK → User |
| messageType | `text \| image \| video \| system \| evidence_request \| offer_notification` | |
| body | String | System order messages: `__order_request:<id>__` |
| mediaUrl | String? | MinIO URL for media messages |
| mediaKey | String? | MinIO key for deletion |
| isSystemGenerated | Boolean | |
| createdAt | DateTime | |

**System message placeholder:** When an OrderRequest is created, a system message is inserted with `body = "__order_request:<orderId>__"`. The frontend resolves this pattern and renders an `OrderRequestCard` component inline in the chat thread.

---

## OrderRequest Flow

When either party clicks "Order" in the conversation:

1. `POST /conversations/:id/order-requests` → creates `OrderRequest` (status: `pending`), inserts system message
2. The other party sees an `OrderRequestCard` in chat
3. **Accept:** `POST /conversations/order-requests/:requestId/accept` → status: `accepted`
4. **Seller fills info:** `PATCH /conversations/order-requests/:requestId/seller-info` (price, quantity) → status: `seller_filled`
5. **Buyer fills info:** `PATCH /conversations/order-requests/:requestId/buyer-info` (phone, email, address, fulfillmentMethod) → status: `buyer_filled`
6. When both sides have filled: `finalizeOrder()` runs atomically:
   - Creates `Offer` + `Order` records
   - Sets `OrderRequest.orderId`, `OrderRequest.status = completed`
   - Closes conversation (`status: closed`, `closeReason: completed`)
   - Emits `order_created` WebSocket event to both parties → frontend redirects to `/orders/:id`
7. **Reject:** `POST /conversations/order-requests/:requestId/reject` → status: `rejected`, no order created

Only one active OrderRequest (status `pending` or `accepted`) is allowed per conversation at a time.

---

## Realtime (WebSocket)

**Namespace:** `/chat`

**Auth:** Client calls `GET /api/auth/ws-token` → gets JWT → passes as `socket.auth.token`.
Gateway verifies token on connect; disconnects if invalid.

**Events:**

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `join_conversation` | client → server | `conversationId: string` | Join the room for this conversation |
| `new_message` | server → client | Message object (with `sender`) | New message sent |
| `stage_changed` | server → client | `{ stage, systemMessage }` | Stage advanced |
| `order_request_updated` | server → client | OrderRequest object | Accept/reject/fill updates |
| `order_created` | server → client | `{ orderId }` | Order finalized → redirect to orders page |

Frontend hook: `hooks/useConversationSocket.ts`

---

## EvidenceRequest

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| conversationId | String | FK → Conversation |
| requesterUserId | String | FK → User (buyer) |
| requestType | `additional_photo \| video \| measurement \| document \| live_demo` | |
| description | String | |
| status | `pending \| fulfilled \| rejected \| expired` | |
| dueAt | DateTime | 48 hours from creation |
| fulfilledAt | DateTime? | |
| rejectionReason | String? | |

---

## Business Rules

| Rule | Description |
|------|-------------|
| R-C1 | Conversation opens when both parties have acknowledged the Match |
| R-C4 | Only one active Conversation per Match |
| R-C5 | Auto-close after 7 days of inactivity |
| R-C6 | Max 5 EvidenceRequests per Conversation |
| R-OR1 | Only one active OrderRequest (pending/accepted) per Conversation |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/conversations` | List my conversations |
| GET | `/api/conversations/:id` | Full thread (includes `orderRequests`) |
| POST | `/api/conversations/:id/messages` | Send text message |
| POST | `/api/conversations/:id/advance-stage` | Advance to next stage |
| POST | `/api/conversations/:id/order-requests` | Initiate OrderRequest |
| POST | `/api/conversations/order-requests/:requestId/accept` | Accept |
| POST | `/api/conversations/order-requests/:requestId/reject` | Reject |
| PATCH | `/api/conversations/order-requests/:requestId/seller-info` | Fill price + quantity |
| PATCH | `/api/conversations/order-requests/:requestId/buyer-info` | Fill contact + fulfillment |
| POST | `/api/conversations/:id/evidence-requests` | Create evidence request |
| PATCH | `/api/conversations/:id/evidence-requests/:erId` | Fulfill / reject |

---

## Related Objects

- [match.md](match.md) — Parent of this conversation
- [order.md](order.md) — Created via OrderRequest flow
- [proof-asset.md](proof-asset.md) — Attached to EvidenceRequests
