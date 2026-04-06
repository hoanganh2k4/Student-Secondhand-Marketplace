# Web API — Next.js Routes

> Platform: Next.js 14 App Router (`app/api/`)
> Auth: `requireAuth()` from `lib/utils/auth.ts` — all routes server-only
> Validation: Zod
> See [ai-api.md](ai-api.md) for the Python AI matching service API.

---

## Conventions

### Route Structure

```typescript
// app/api/demands/route.ts
export async function POST(req: NextRequest) {
  const user = await requireAuth()           // throws UNAUTHORIZED if not authed
  const body = CreateDemandSchema.parse(await req.json())  // throws ZodError if invalid
  // ... business logic
  return NextResponse.json(result, { status: 201 })
}
```

### Error Response

```json
{ "error": "Human readable message" }
// or for Zod validation:
{ "error": [{ "path": ["budgetMin"], "message": "Required" }] }
```

| Code | When |
|------|------|
| 400 | Zod validation error |
| 401 | Not authenticated |
| 403 | Authenticated but wrong role / not a participant |
| 404 | Record not found |
| 409 | Conflict (duplicate, offer already active) |
| 422 | Valid input but business rule violation |
| 429 | Rate limit exceeded |
| 500 | Unexpected server error |

---

## Endpoints

### Demand Requests

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/demands` | Create DemandRequest; triggers AI + rule-based matching | Buyer |
| GET | `/api/demands` | List my demand requests | Self |
| GET | `/api/demands/[id]` | Get demand + its matches | Owner |
| PATCH | `/api/demands/[id]` | Update demand (draft status only) | Owner |
| DELETE | `/api/demands/[id]` | Cancel demand | Owner |

**POST /api/demands body:**
```typescript
{
  title:               string       // 3–120 chars
  categoryId:          string       // UUID
  subcategoryId?:      string       // UUID
  description?:        string       // max 1000
  budgetMin:           number       // positive
  budgetMax:           number       // ≥ budgetMin
  preferredCondition?: 'any' | 'good' | 'very_good' | 'like_new'
  quantityNeeded?:     number       // int, min 1, default 1
  location?:           string
  urgency?:            'flexible' | 'within_week' | 'within_month'
  specialRequirements?: string      // max 500
}
```

---

### Product Listings

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/listings` | Create ProductListing (draft) | Seller |
| GET | `/api/listings` | List my listings | Self |
| GET | `/api/listings/[id]` | Get listing + its matches | Any authenticated |
| PATCH | `/api/listings/[id]` | Update listing (draft only) | Owner |
| POST | `/api/listings/[id]/publish` | Draft → active; validates proof; triggers matching | Owner |
| DELETE | `/api/listings/[id]` | Remove listing | Owner |

---

### Matches

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/matches/[id]` | Get match + score breakdown | Participant |
| POST | `/api/matches/[id]/acknowledge` | Buyer or seller acknowledges match | Participant |
| POST | `/api/matches/[id]/decline` | Buyer or seller declines match | Participant |

---

### Conversations

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/conversations` | List user's conversations (inbox) | Self |
| GET | `/api/conversations/[id]` | Get conversation + messages + evidence requests | Participant |
| POST | `/api/conversations/[id]/messages` | Send a message (stage-gated) | Participant |
| POST | `/api/conversations/[id]/advance-stage` | Advance verification → clarification | Buyer only |
| POST | `/api/conversations/[id]/evidence-requests` | Create EvidenceRequest (max 5) | Buyer only |
| PATCH | `/api/conversations/[id]/evidence-requests/[erId]` | Fulfill or reject EvidenceRequest | Seller only |
| POST | `/api/conversations/[id]/offers` | Create Offer (negotiation stage only) | Participant |

**Stage-gating — text messages blocked in verification:**
```typescript
if (conversation.stage === 'verification' && messageType === 'text') {
  return NextResponse.json({ error: 'Text messages not available in verification stage.' }, { status: 422 })
}
```

**Rate limiting — 10 messages/hour (DB counter, no Redis):**
```typescript
const recentCount = await prisma.message.count({
  where: { conversationId, senderUserId: user.id, createdAt: { gte: oneHourAgo } }
})
if (recentCount >= 10) return NextResponse.json({ error: 'Rate limit reached' }, { status: 429 })
```

---

### Offers

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/offers/[id]` | Get offer detail | Participant |
| POST | `/api/offers/[id]/accept` | Accept offer; creates Order atomically | Recipient |
| POST | `/api/offers/[id]/reject` | Reject offer | Recipient |
| POST | `/api/offers/[id]/counter` | Create counter-offer | Recipient |
| DELETE | `/api/offers/[id]` | Cancel offer (creator only, before response) | Creator |

---

### Orders

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/orders` | List user's orders | Self |
| GET | `/api/orders/[id]` | Get order detail + proof snapshot | Participant |
| POST | `/api/orders/[id]/confirm` | Mark completion (both sides needed) | Participant |
| POST | `/api/orders/[id]/cancel` | Cancel order (reason required) | Participant |
| POST | `/api/orders/[id]/dispute` | File a Dispute (within 48h of completion) | Participant |
| POST | `/api/orders/[id]/review` | Submit RatingReview (after completion, 7-day window) | Participant |

---

### Upload

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/upload` | Upload ProofAsset to Supabase Storage | Any authenticated |

---

### Admin

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/admin/disputes` | List all disputes | Admin |
| PATCH | `/api/admin/disputes/[id]/resolve` | Set dispute resolution | Admin |
| PATCH | `/api/admin/users/[id]/suspend` | Suspend a user | Admin |
| PATCH | `/api/admin/users/[id]/ban` | Ban a user | Admin |
| PATCH | `/api/admin/listings/[id]/remove` | Force-remove a listing | Admin |

---

## Matching Trigger Pattern

Both demand and listing creation fire matching asynchronously (fire-and-forget at MVP):

```typescript
// After creating demand:
matchDemandAgainstListings(demand.id).catch(console.error)

// After publishing listing:
matchListingAgainstDemands(listing.id).catch(console.error)
```

Matching calls the AI service (`AI_SERVICE_URL/search`) and merges results with rule-based scoring. See [../services/matching-engine.md](../services/matching-engine.md) and [../services/matching-ai.md](../services/matching-ai.md).
