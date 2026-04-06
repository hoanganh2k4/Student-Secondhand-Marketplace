# Object: Notification

> Table: `notifications`
> In-app notification record. Email is sent via Resend in parallel.

---

## Fields

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| userId | String | FK → User (recipient) |
| type | String | Notification type key (see below) |
| referenceType | String? | `match \| conversation \| offer \| order \| dispute` |
| referenceId | String? | UUID of the referenced object |
| body | String | Human-readable text |
| read | Boolean | default: false |
| createdAt | DateTime | |

---

## Notification Types

| Type | Trigger | Recipients |
|------|---------|-----------|
| `match_proposed` | New Match created | Buyer + Seller |
| `match_acknowledged` | Other party acknowledged | Counterparty |
| `match_declined` | Other party declined | Counterparty |
| `conversation_opened` | Conversation created | Buyer + Seller |
| `stage_advanced` | Conversation stage changed | Both |
| `evidence_requested` | EvidenceRequest created | Seller |
| `evidence_fulfilled` | EvidenceRequest fulfilled | Buyer |
| `evidence_rejected` | EvidenceRequest rejected | Buyer |
| `offer_received` | Offer created and sent | Recipient |
| `offer_accepted` | Offer accepted | Creator |
| `offer_rejected` | Offer rejected | Creator |
| `offer_countered` | Counter-offer created | Original creator |
| `offer_expired` | Offer not responded to in 48h | Creator |
| `order_created` | Order created | Buyer + Seller |
| `order_completed` | Both confirmed complete | Buyer + Seller |
| `order_cancelled` | Order cancelled | Counterparty |
| `dispute_opened` | Dispute filed | Counterparty + Admin |
| `dispute_resolved` | Admin resolved dispute | Buyer + Seller |
| `demand_expiring` | Demand expires in 3 days | Buyer |
| `listing_expiring` | Listing expires in 3 days | Seller |

---

## Real-time Delivery

Notifications are delivered via Supabase Realtime (Postgres change-data-capture).
See [../realtime.md](../../frontend/realtime.md) for the frontend hook implementation.

```sql
ALTER TABLE notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
```

---

## Email

Each notification type maps to a React Email template sent via Resend.
See [../services/notifications.md](../services/notifications.md) for email implementation.

---

## Business Rules

| Rule | Description |
|------|-------------|
| R-N1 | Notification record created before email is sent |
| R-N2 | Email failure does not block the triggering action |
| R-N3 | `read` marked true when user opens the referenced page |

---

## Related Objects

- All domain objects — notifications reference them via `referenceType` + `referenceId`
