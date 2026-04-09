# Object: Match

> Table: `matches`
> System-created link between a DemandRequest and a ProductListing.
> Unique constraint: `(demandRequestId, productListingId)`

---

## Fields

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| demandRequestId | String | FK → DemandRequest |
| productListingId | String | FK → ProductListing |
| matchScore | Int | 0–100 (`finalScore × 100`) |
| matchConfidence | `high \| medium \| low` | ≥75=high, ≥50=medium, else low |
| scoreBreakdown | JSON | `{ textScore, finalScore, penalties }` |
| missingInfoFlags | String[] | e.g. `["no_listing_images"]` |
| status | MatchStatus | see state machine |
| buyerAcknowledged | Boolean | |
| sellerAcknowledged | Boolean | |
| createdAt | DateTime | |
| snapshot | MatchSnapshot? | one-to-one, created with match |
| interactions | MatchInteraction[] | event stream |

---

## Score Breakdown Shape

```json
{
  "textScore":  0.7695,
  "finalScore": 0.7695,
  "penalties":  {}
}
```

With price penalty:
```json
{
  "textScore":  0.72,
  "finalScore": 0.54,
  "penalties":  { "price": 0.75 }
}
```

See [matching-engine.md](../services/matching-engine.md) for penalty rules.

---

## State Machine

```
proposed
  ├─→ buyer_confirmed  ─┐
  ├─→ seller_confirmed  ├─→ active → closed_success
  └─→ closed_failed ←───┘          ↘ closed_failed
```

| Status | Meaning |
|--------|---------|
| `proposed` | Created by engine, neither party acknowledged |
| `buyer_confirmed` | Buyer clicked Accept |
| `seller_confirmed` | Seller clicked Accept |
| `active` | Both confirmed → Conversation opened |
| `closed_success` | Order completed |
| `closed_failed` | Declined or conversation closed without order |

---

## MatchSnapshot

Saved once per match at creation time. Used as LTR training features.

| Field | Type | Notes |
|-------|------|-------|
| matchId | String | 1-to-1 with Match |
| modelVersion | String | default `v1` |
| rankPosition | Int | position in candidate list (1-based) |
| candidateSetSize | Int | total candidates scored this run |
| textScore | Float | raw cosine similarity from `/score-pairs` |
| visualScore | Float? | CLIP score (null until implemented) |
| finalScore | Float | after penalties |
| penaltiesApplied | JSON | `{ price: 0.75 }` or `{}` |
| demandSnapshot | JSON | `{ title, category, budgetMin, budgetMax, preferredCondition, location }` |
| listingSnapshot | JSON | `{ title, category, price, condition, hasImage, imageCount, hasVision }` |
| featureVector | JSON | flat LTR features — see below |

### Feature Vector

```json
{
  "textScore":        0.7695,
  "finalScore":       0.7695,
  "priceRatio":       0.9,
  "conditionMatch":   1,
  "conditionGap":     1,
  "hasImage":         1,
  "hasVision":        1,
  "hasBudget":        1,
  "hasConditionPref": 1
}
```

---

## MatchInteraction

One row per user action. Used to derive training labels.

| Field | Type | Notes |
|-------|------|-------|
| matchId | String | FK → Match |
| snapshotId | String? | FK → MatchSnapshot (null for auto-logged events) |
| userId | String | FK → User |
| action | String | see table below |
| surface | String? | `match_list \| push_notification \| home_feed \| direct` |
| sessionId | String? | |
| metadata | JSON? | |
| createdAt | DateTime | |

### Actions and Label Values

| Action | Label | Logged by |
|--------|-------|-----------|
| `ordered` | 1.0 | auto — conversations.service / offers.service |
| `offered` | 0.9 | auto — offers.service |
| `messaged` | 0.7 | auto — conversations.service (first message only) |
| `accepted` | 0.5 | manual — `POST /matches/:id/interact` |
| `detail_viewed` | 0.3 | manual — `POST /matches/:id/interact` |
| `impressed` | 0.2 | manual |
| `dismissed` | 0.0 | manual |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/matches/:id` | Match + demand + listing |
| GET | `/api/matches/:id/snapshot` | Score breakdown + feature vector |
| GET | `/api/matches/:id/interactions` | All interaction events + aggregated label |
| POST | `/api/matches/:id/acknowledge` | Accept match |
| POST | `/api/matches/:id/decline` | Decline match |
| POST | `/api/matches/:id/interact` | Log interaction event |
