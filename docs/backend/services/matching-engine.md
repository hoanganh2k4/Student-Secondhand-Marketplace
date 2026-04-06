# Matching Engine Implementation

> Location in repo: `lib/matching/`
> Trigger: Synchronous call from API route after DemandRequest or ProductListing is created
> Upgrade path: Move to async job queue (BullMQ + Redis) in Phase 2
> AI layer: See [matching-ai.md](matching-ai.md) for semantic scoring, intent extraction, and LLM verdict

---

## File Structure

```
lib/matching/
├── engine.ts              — Core orchestration: fetch candidates, score, insert matches
├── normalizer.ts          — Pure functions: convert raw values to 0–1 scale
├── weights.ts             — Dimension weight configuration
└── ai/
    ├── intent-extractor.ts  — Claude Haiku: extract structured intent from demand text
    ├── embedder.ts          — OpenAI: generate embeddings + build embedding text
    ├── embedding-store.ts   — Supabase RPC: store vectors in pgvector columns
    ├── semantic-search.ts   — pgvector ANN: find semantically similar listings
    ├── intent-adjuster.ts   — Pure: apply intent signals as score adjustments
    ├── match-verifier.ts    — Claude Haiku: final verdict on top matches
    └── category-suggester.ts— Suggest category from title using embeddings
```

---

## Weights Configuration

> Updated to include semantic dimension. Total remains 100.
> See [matching-ai.md](matching-ai.md) for how the semantic score is computed.

```typescript
// lib/matching/weights.ts
export const WEIGHTS = {
  category:  25,   // down from 30 — semantic absorbs some category signal
  price:     22,   // down from 25
  condition: 17,   // down from 20
  location:  13,   // down from 15
  quantity:  8,    // down from 10
  semantic:  15,   // NEW: cosine similarity between demand and listing embeddings
} as const
```

These weights sum to 100. Adjust them without changing engine logic.

---

## Normalizer

```typescript
// lib/matching/normalizer.ts

const CONDITION_SCALE: Record<string, number> = {
  poor: 1, fair: 2, good: 3, very_good: 4, like_new: 5
}

export function normalizeCondition(condition: string): number {
  return CONDITION_SCALE[condition] ?? 0
}

export function normalizePriceCompatibility(
  listingPrice: number,
  demandMin: number,
  demandMax: number
): number {
  if (listingPrice >= demandMin && listingPrice <= demandMax) return 1.0
  if (listingPrice > demandMax) {
    const overage = (listingPrice - demandMax) / demandMax
    if (overage <= 0.2) return 0.6
    if (overage <= 0.5) return 0.3
    return 0
  }
  // listing price below min: still a match (buyer might accept)
  return 0.8
}

export function normalizeCategoryMatch(
  listingCategoryId: string,
  listingSubcategoryId: string | null,
  demandCategoryId: string,
  demandSubcategoryId: string | null
): number {
  if (listingCategoryId !== demandCategoryId) return 0
  if (!demandSubcategoryId) return 1.0            // buyer didn't specify sub
  if (listingSubcategoryId === demandSubcategoryId) return 1.0
  if (listingSubcategoryId === null) return 0.6   // listing is broader
  return 0.3                                       // different subcategory, same parent
}

export function normalizeQuantity(
  quantityRemaining: number,
  quantityNeeded: number
): number {
  if (quantityRemaining >= quantityNeeded) return 1.0
  if (quantityRemaining > 0) return 0.5
  return 0
}
```

---

## Scoring Engine

```typescript
// lib/matching/engine.ts
import { prisma } from '@/lib/prisma'
import { WEIGHTS } from './weights'
import {
  normalizeCategoryMatch,
  normalizeCondition,
  normalizePriceCompatibility,
  normalizeQuantity,
} from './normalizer'

interface ScoreBreakdown {
  category:  number  // 0–100
  price:     number
  condition: number
  location:  number
  quantity:  number
  semantic:  number  // 0–100, from AI matching service (0 if service unavailable)
}

function computeScore(breakdown: ScoreBreakdown): number {
  return Math.round(
    breakdown.category  * WEIGHTS.category  / 100 +
    breakdown.price     * WEIGHTS.price     / 100 +
    breakdown.condition * WEIGHTS.condition / 100 +
    breakdown.location  * WEIGHTS.location  / 100 +
    breakdown.quantity  * WEIGHTS.quantity  / 100 +
    breakdown.semantic  * WEIGHTS.semantic  / 100
  )
}

function deriveConfidence(score: number): 'high' | 'medium' | 'low' {
  if (score >= 80) return 'high'
  if (score >= 60) return 'medium'
  return 'low'
}

function detectMissingInfoFlags(breakdown: ScoreBreakdown, listing: any): string[] {
  const flags: string[] = []
  if (breakdown.price     < 30)  flags.push('price_mismatch')
  if (breakdown.condition < 50)  flags.push('condition_below_requirement')
  if (breakdown.location  < 30)  flags.push('location_incompatible')
  if (breakdown.quantity  === 50) flags.push('quantity_partial')
  if (breakdown.category  < 70)  flags.push('category_approximate')
  if (listing.proofCompletenessScore < 60) flags.push('insufficient_proof')
  return flags
}

// Called when a DemandRequest is created or re-activated.
export async function matchDemandAgainstListings(demandId: string) {
  const demand = await prisma.demandRequest.findUniqueOrThrow({
    where: { id: demandId }
  })

  const existingMatchListingIds = await prisma.match
    .findMany({ where: { demandRequestId: demandId }, select: { productListingId: true } })
    .then(ms => ms.map(m => m.productListingId))

  const candidates = await prisma.productListing.findMany({
    where: {
      status: 'active',
      categoryId: demand.categoryId,
      id: { notIn: existingMatchListingIds },
      quantityRemaining: { gt: 0 },
    },
    take: 50,
  })

  const matchesToCreate = []

  for (const listing of candidates) {
    const conditionScore = (() => {
      const listingLevel = normalizeCondition(listing.condition)
      const demandLevel  = normalizeCondition(demand.preferredCondition)
      return listingLevel >= demandLevel
        ? (listingLevel / 5) * 100
        : Math.max(0, ((listingLevel - demandLevel + 5) / 10)) * 100
    })()

    const breakdown: ScoreBreakdown = {
      category:  normalizeCategoryMatch(
                   listing.categoryId, listing.subcategoryId,
                   demand.categoryId,  demand.subcategoryId
                 ) * 100,
      price:     normalizePriceCompatibility(
                   Number(listing.priceExpectation),
                   Number(demand.budgetMin),
                   Number(demand.budgetMax)
                 ) * 100,
      condition: conditionScore,
      location:  listing.location === demand.location ? 100 : 50, // simplified for MVP
      quantity:  normalizeQuantity(listing.quantityRemaining, demand.quantityNeeded) * 100,
    }

    const score = computeScore(breakdown)
    if (score < 40) continue

    matchesToCreate.push({
      demandRequestId:   demand.id,
      productListingId:  listing.id,
      matchScore:        score,
      matchConfidence:   deriveConfidence(score),
      scoreBreakdown:    breakdown,
      missingInfoFlags:  detectMissingInfoFlags(breakdown, listing),
    })
  }

  if (matchesToCreate.length === 0) {
    await prisma.demandRequest.update({ where: { id: demandId }, data: { status: 'waiting' } })
    return
  }

  await prisma.match.createMany({ data: matchesToCreate, skipDuplicates: true })
  await prisma.demandRequest.update({ where: { id: demandId }, data: { status: 'matched' } })

  // TODO: notify both sides for each created match — see notifications.md
}

// Called when a ProductListing is created or re-activated.
// Mirror of matchDemandAgainstListings with demand/listing roles swapped.
export async function matchListingAgainstDemands(listingId: string) {
  const listing = await prisma.productListing.findUniqueOrThrow({
    where: { id: listingId }
  })

  const existingMatchDemandIds = await prisma.match
    .findMany({ where: { productListingId: listingId }, select: { demandRequestId: true } })
    .then(ms => ms.map(m => m.demandRequestId))

  const candidates = await prisma.demandRequest.findMany({
    where: {
      status: { in: ['active', 'waiting', 'matched'] },
      categoryId: listing.categoryId,
      id: { notIn: existingMatchDemandIds },
    },
    take: 50,
  })

  const matchesToCreate = []

  for (const demand of candidates) {
    const conditionScore = (() => {
      const listingLevel = normalizeCondition(listing.condition)
      const demandLevel  = normalizeCondition(demand.preferredCondition)
      return listingLevel >= demandLevel
        ? (listingLevel / 5) * 100
        : Math.max(0, ((listingLevel - demandLevel + 5) / 10)) * 100
    })()

    const breakdown: ScoreBreakdown = {
      category:  normalizeCategoryMatch(
                   listing.categoryId, listing.subcategoryId,
                   demand.categoryId,  demand.subcategoryId
                 ) * 100,
      price:     normalizePriceCompatibility(
                   Number(listing.priceExpectation),
                   Number(demand.budgetMin),
                   Number(demand.budgetMax)
                 ) * 100,
      condition: conditionScore,
      location:  listing.location === demand.location ? 100 : 50,
      quantity:  normalizeQuantity(listing.quantityRemaining, demand.quantityNeeded) * 100,
    }

    const score = computeScore(breakdown)
    if (score < 40) continue

    matchesToCreate.push({
      demandRequestId:   demand.id,
      productListingId:  listing.id,
      matchScore:        score,
      matchConfidence:   deriveConfidence(score),
      scoreBreakdown:    breakdown,
      missingInfoFlags:  detectMissingInfoFlags(breakdown, listing),
    })
  }

  if (matchesToCreate.length === 0) return

  await prisma.match.createMany({ data: matchesToCreate, skipDuplicates: true })
  // Update any previously-waiting demands that now have a match
  const affectedDemandIds = matchesToCreate.map(m => m.demandRequestId)
  await prisma.demandRequest.updateMany({
    where: { id: { in: affectedDemandIds }, status: 'waiting' },
    data:  { status: 'matched' }
  })
}
```

---

## Confidence Thresholds and Actions

| Score | Confidence | Auto-open conversation? |
|-------|-----------|------------------------|
| 80–100 | high | Yes, after 24-hour window if neither declines |
| 60–79 | medium | Only after both sides explicitly accept |
| 40–59 | low | Only after both sides explicitly confirm |
| < 40 | — | No match record created |

---

## How to Trigger from API Routes

```typescript
// In POST /api/demands handler, after creating the demand:
matchDemandAgainstListings(demand.id).catch(console.error)

// In POST /api/listings/[id]/publish handler, after activating listing:
matchListingAgainstDemands(listing.id).catch(console.error)
```

The `.catch(console.error)` makes this fire-and-forget for MVP. In Phase 2, replace with an async job queue so the API response is not blocked.

---

## Semantic Score Integration

The `semantic` dimension is sourced from the AI matching microservice (see [matching-ai.md](matching-ai.md)).

### How it is obtained

Inside `matchDemandAgainstListings` / `matchListingAgainstDemands`, after rule-based scoring, the engine calls the AI service with the demand query and gets back per-listing semantic scores:

```typescript
// Call AI service; fall back to 0 for each listing on timeout or error
async function fetchSemanticScores(
  query: string,
  listingIds: string[]
): Promise<Map<string, number>> {
  const scores = new Map<string, number>()
  listingIds.forEach(id => scores.set(id, 0))  // default 0

  try {
    const res = await fetch(`${process.env.AI_SERVICE_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, top_k: listingIds.length }),
      signal: AbortSignal.timeout(3000),  // 3-second hard deadline
    })
    if (!res.ok) return scores

    const data = await res.json()
    for (const result of data.results ?? []) {
      if (listingIds.includes(result.id)) {
        scores.set(result.id, Math.round((result.rerank_score ?? 0) * 100))
      }
    }
  } catch {
    // Service down or timed out — semantic dimension scores stay at 0
  }
  return scores
}
```

### Timeout behaviour

If the AI service does not respond within **3 seconds**, all semantic scores default to `0`. The match still proceeds using the remaining 85 points across rule-based dimensions — a listing can score up to 85 without any semantic contribution.

This keeps the matching engine responsive even when the AI service is unavailable.
