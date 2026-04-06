# Object: Conversation

> Tables: `conversations`, `messages`, `evidence_requests`
> The structured communication channel between buyer and seller for a Match.
> One conversation per match (unique constraint on `matchId`).

---

## Conversation

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
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

| Stage | Who controls | Gate condition |
|-------|-------------|----------------|
| `verification` | Buyer | Buyer reviews proof, requests evidence |
| `clarification` | Both | Buyer clicks "I'm satisfied →" |
| `negotiation` | Both | Buyer clicks "Ready to make an offer →" |
| `closed` | System | Order completed or conversation abandoned |

- Text messaging disabled in `verification` stage
- EvidenceRequests only creatable in `verification` stage
- Offers only creatable in `negotiation` stage

---

## Message

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| conversationId | String | FK → Conversation |
| senderUserId | String | FK → User |
| messageType | `text \| system \| evidence_request \| offer_notification` | |
| body | String | |
| isSystemGenerated | Boolean | system events vs user messages |
| createdAt | DateTime | |

**Rate limit:** 10 messages/hour per user per conversation (DB counter).

---

## EvidenceRequest

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| conversationId | String | FK → Conversation |
| requesterUserId | String | FK → User (buyer) |
| requestType | `additional_photo \| video \| measurement \| document \| live_demo` | |
| description | String | What specifically is needed |
| status | `pending \| fulfilled \| rejected \| expired` | |
| dueAt | DateTime | 48 hours from creation |
| fulfilledAt | DateTime? | |
| rejectionReason | String? | |

**Constraints:**
- Max 5 EvidenceRequests per Conversation
- Seller must respond within 48 hours or request auto-expires
- Expired without response → decrements seller reliability score

---

## Business Rules

| Rule | Description |
|------|-------------|
| R-C1 | Conversation opens only on Match with score ≥ 60 AND at least one side acknowledged |
| R-C2 | Score ≥ 80: auto-open after 24h if neither declines |
| R-C3 | Score 60–79: both must explicitly accept |
| R-C4 | Only one active Conversation per Match |
| R-C5 | Auto-close after 7 days of inactivity |
| R-C6 | Max 5 EvidenceRequests per Conversation |
| R-C7 | Text rate limit: 10 messages/hour per user |

---

## Related API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/conversations` | Inbox |
| GET | `/api/conversations/[id]` | Full thread |
| POST | `/api/conversations/[id]/messages` | Send message |
| POST | `/api/conversations/[id]/advance-stage` | Advance stage |
| POST | `/api/conversations/[id]/evidence-requests` | Create evidence request |
| PATCH | `/api/conversations/[id]/evidence-requests/[erId]` | Fulfill/reject |
| POST | `/api/conversations/[id]/offers` | Create offer |

---

## Related Objects

- [match.md](match.md) — Parent of this conversation
- [offer.md](offer.md) — Created in negotiation stage
- [proof-asset.md](proof-asset.md) — Attached to EvidenceRequests
