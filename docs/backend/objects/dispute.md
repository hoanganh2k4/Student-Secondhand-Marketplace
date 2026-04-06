# Object: Dispute

> Table: `disputes`
> Filed by a participant when an order does not go as agreed.
> One dispute per order (unique constraint on `orderId`).

---

## Fields

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| orderId | String | FK → Order, unique |
| filedByUserId | String | FK → User |
| disputeType | `item_not_as_described \| no_show \| fake_proof \| other` | |
| description | String | Free text account of the issue |
| evidenceAssets | String[] | Asset URLs submitted with dispute |
| status | `opened \| under_review \| resolved \| closed` | |
| assignedAdminId | String? | FK → User (admin) |
| resolution | `resolved_for_buyer \| resolved_for_seller \| mutual \| dismissed`? | |
| resolutionNotes | String? | Admin explanation |
| openedAt | DateTime | |
| resolvedAt | DateTime? | |

---

## State Machine

```
opened → under_review → resolved → closed
                      ↘ dismissed
```

---

## Business Rules

| Rule | Description |
|------|-------------|
| R-DP1 | Dispute must be filed within 48 hours of `Order.completedAt` |
| R-DP2 | Only one dispute per Order |
| R-DP3 | Filing a dispute does not automatically reverse the Order |
| R-DP4 | Admin assigns themselves as `assignedAdminId` |
| R-DP5 | Resolution notes required before closing |

---

## Related API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/orders/[id]/dispute` | File dispute |
| GET | `/api/admin/disputes` | Admin: list all |
| PATCH | `/api/admin/disputes/[id]/resolve` | Admin: set resolution |

---

## Related Objects

- [order.md](order.md) — The disputed order
- [user.md](user.md) — Filer and assigned admin
