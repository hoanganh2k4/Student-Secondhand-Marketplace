# Matching Engine

> Location: `backend/src/matching/`
> Language: NestJS (TypeScript)
> Trigger: Called after demand activated or listing published
> AI layer: Delegates scoring to `AiService` → FastAPI microservice

---

## How It Works

```
Demand activated  ─┐
                   ├─→ MatchingService → POST /score-pairs (AI) → Match + MatchSnapshot created
Listing published ─┘
```

Both flows use the same AI-first approach: all candidates in the same category are scored together via the AI microservice in a single batch call. No rule-based pre-scoring.

---

## Trigger Points

```typescript
// demands.service.ts — after status set to 'active'
this.matching.runForDemand(demandId)

// listings.service.ts — after status set to 'active'
this.matching.runForListing(listingId)
```

Both calls are fire-and-forget (`.catch(() => null)`). The API response is not blocked.

---

## Hard Filters (before scoring)

Applied in the Prisma query — candidates that fail are never sent to the AI service:

| Filter | Rule |
|--------|------|
| Same user | `sellerProfile.userId ≠ demand.buyerProfile.userId` |
| Category | Must match exactly |
| Listing status | Must be `active` |
| Demand status | Must be `active` or `waiting` |

---

## Structured Text Format

Both demand and listing text are built in a stable key:value format before being sent to `/score-pairs`:

```
title: MacBook Pro 2020 M1
category: Electronics
description: Máy đẹp, pin tốt, full box
condition: very good
location: Hanoi
price: 18,000,000 VND
vision: The image shows an Apple MacBook Pro... | MacBook Pro | laptop
```

- Vision text comes from Florence-2 attributes stored in `ProofAsset.aiAttributes`
- Total text is hard-capped at 512 characters (SentenceTransformer limit)
- Vision text is pre-truncated to 200 characters

---

## Soft Penalties (after scoring)

Applied to the raw cosine similarity score to compute `finalScore`:

| Condition | Penalty multiplier |
|-----------|-------------------|
| Price > budget | `× 0.75` |
| Price > 120% of budget | `× 0.4` |
| Listing condition 1 tier below preferred | `× 0.8` |
| Listing condition 2+ tiers below preferred | `× 0.5` |
| No penalty | `× 1.0` |

Condition order: `poor < fair < good < very_good < like_new`

---

## Threshold

`finalScore >= 0.30` → Match created. Below threshold: skipped silently.

---

## Match + MatchSnapshot Creation

For each match above threshold:

```typescript
// 1. Create Match record
const match = await prisma.match.create({
  data: {
    matchScore:      Math.round(finalScore * 100),
    matchConfidence: 'high' | 'medium' | 'low',
    scoreBreakdown:  { textScore, finalScore, penalties },
    missingInfoFlags: [...],
    status: 'proposed',
  },
})

// 2. Save MatchSnapshot for LTR training data
await prisma.matchSnapshot.create({
  data: {
    matchId, rankPosition, candidateSetSize,
    textScore, visualScore: null, finalScore,
    penaltiesApplied, demandSnapshot, listingSnapshot,
    featureVector: { textScore, finalScore, priceRatio, conditionMatch, conditionGap,
                     hasImage, hasVision, hasBudget, hasConditionPref },
  },
})
```

---

## Score Breakdown Shape

```json
{
  "textScore":  0.7695,
  "finalScore": 0.7695,
  "penalties":  {}
}
```

With penalty example:
```json
{
  "textScore":  0.72,
  "finalScore": 0.54,
  "penalties":  { "price": 0.75 }
}
```

---

## Missing Info Flags

| Flag | Condition |
|------|-----------|
| `no_listing_description` | Listing has no description |
| `no_demand_description` | Demand has no description |
| `no_listing_images` | No proof assets uploaded |
| `low_proof_score` | `proofCompletenessScore < 60` |
| `no_listing_location` | Listing has no location |
| `no_demand_location` | Demand has no location |

---

## AiMatchLog

After each run, a log entry is saved:

```json
{
  "triggeredBy":    "demand",
  "sourceId":       "<demandId>",
  "sourceText":     "title: Cần mua laptop...",
  "candidateCount": 2,
  "results":        [{ "id": "<listingId>", "score": 0.757 }],
  "matchesCreated": 1
}
```

Query via `GET /api/ai/match-logs`.
