# Domain Objects

> Each file documents one domain object: fields, state machine, business rules, and related API endpoints.
> For the full Prisma schema see [../schema.prisma.md](../schema.prisma.md).

---

## Object Map

```
User ──────────────────┐
  ├── BuyerProfile     │
  │     └── DemandRequest ──────────────────────────────┐
  └── SellerProfile                                      │
        └── ProductListing ─── ProofAsset               │
                    │                                    │
                    └──────────── Match ─────────────────┘
                                    │
                                Conversation
                                    ├── Message
                                    ├── EvidenceRequest ── ProofAsset
                                    └── Offer
                                          │
                                        Order
                                          ├── Dispute
                                          ├── RatingReview
                                          └── Notification (all objects)
```

---

## Files

| File | Object(s) | Key state machine |
|------|-----------|-------------------|
| [user.md](user.md) | User, StudentProfile, BuyerProfile, SellerProfile | active / suspended / banned |
| [demand-request.md](demand-request.md) | DemandRequest | draft → active → matched → fulfilled |
| [product-listing.md](product-listing.md) | ProductListing | draft → active → sold |
| [match.md](match.md) | Match | proposed → active → closed |
| [conversation.md](conversation.md) | Conversation, Message, EvidenceRequest | verification → clarification → negotiation |
| [offer.md](offer.md) | Offer | pending → accepted / rejected / countered |
| [order.md](order.md) | Order | created → completed / disputed |
| [proof-asset.md](proof-asset.md) | ProofAsset | — |
| [dispute.md](dispute.md) | Dispute | opened → resolved |
| [notification.md](notification.md) | Notification | — |
