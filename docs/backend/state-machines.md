# State Machine Implementation

> Location in repo: `lib/state-machines/`
> Pattern: Pure transition functions with explicit tables — called before every DB write that changes status.

---

## Pattern

Each state machine is a module that exports one `transitionX(current, event)` function. The function looks up the valid next state from a transition table. If no valid transition exists, it throws — the API route handler catches this and returns 422.

This means no invalid state can ever be written to the database.

```typescript
// Generic pattern used by all state machines

type Status = 'A' | 'B' | 'C'
type Event  = 'EVENT_1' | 'EVENT_2'

const TRANSITIONS: Record<Status, Partial<Record<Event, Status>>> = {
  A: { EVENT_1: 'B' },
  B: { EVENT_2: 'C' },
  C: {},
}

export function transition(current: Status, event: Event): Status {
  const next = TRANSITIONS[current]?.[event]
  if (!next) throw new Error(`Invalid transition: ${current} + ${event}`)
  return next
}
```

---

## lib/state-machines/offer.ts

```typescript
type OfferStatus =
  | 'draft' | 'pending' | 'countered'
  | 'accepted' | 'rejected' | 'expired' | 'cancelled'

type OfferEvent =
  | 'SUBMIT' | 'ACCEPT' | 'REJECT' | 'COUNTER' | 'EXPIRE' | 'CANCEL'

const OFFER_TRANSITIONS: Record<OfferStatus, Partial<Record<OfferEvent, OfferStatus>>> = {
  draft:     { SUBMIT: 'pending' },
  pending:   {
    ACCEPT:  'accepted',
    REJECT:  'rejected',
    COUNTER: 'countered',
    EXPIRE:  'expired',
    CANCEL:  'cancelled',
  },
  countered: {},
  accepted:  {},
  rejected:  {},
  expired:   {},
  cancelled: {},
}

export function transitionOffer(current: OfferStatus, event: OfferEvent): OfferStatus {
  const next = OFFER_TRANSITIONS[current]?.[event]
  if (!next) throw new Error(`Invalid offer transition: ${current} + ${event}`)
  return next
}
```

---

## lib/state-machines/order.ts

```typescript
type OrderStatus =
  | 'created' | 'confirmed' | 'in_progress'
  | 'completed' | 'cancelled' | 'disputed'

type OrderEvent =
  | 'BOTH_CONFIRM' | 'MEETUP_TIME_PASSED' | 'BOTH_COMPLETE'
  | 'CANCEL' | 'FILE_DISPUTE'

const ORDER_TRANSITIONS: Record<OrderStatus, Partial<Record<OrderEvent, OrderStatus>>> = {
  created:     { BOTH_CONFIRM: 'confirmed' },
  confirmed:   { MEETUP_TIME_PASSED: 'in_progress', CANCEL: 'cancelled' },
  in_progress: { BOTH_COMPLETE: 'completed', CANCEL: 'cancelled', FILE_DISPUTE: 'disputed' },
  completed:   { FILE_DISPUTE: 'disputed' },   // 48-hour window
  cancelled:   {},
  disputed:    {},
}

export function transitionOrder(current: OrderStatus, event: OrderEvent): OrderStatus {
  const next = ORDER_TRANSITIONS[current]?.[event]
  if (!next) throw new Error(`Invalid order transition: ${current} + ${event}`)
  return next
}
```

---

## lib/state-machines/demand.ts

```typescript
type DemandStatus =
  | 'draft' | 'active' | 'waiting' | 'matched'
  | 'in_conversation' | 'in_negotiation'
  | 'fulfilled' | 'expired' | 'cancelled'

type DemandEvent =
  | 'SUBMIT' | 'NO_MATCHES_FOUND' | 'MATCH_CREATED'
  | 'CONVERSATION_OPENED' | 'OFFER_STAGE_STARTED'
  | 'ORDER_CREATED_FULFILLED' | 'OFFER_FAILED'
  | 'CONVERSATION_CLOSED' | 'ALL_MATCHES_EXPIRED'
  | 'EXPIRE' | 'CANCEL'

const DEMAND_TRANSITIONS: Record<DemandStatus, Partial<Record<DemandEvent, DemandStatus>>> = {
  draft:           { SUBMIT: 'active' },
  active:          { NO_MATCHES_FOUND: 'waiting', MATCH_CREATED: 'matched', EXPIRE: 'expired', CANCEL: 'cancelled' },
  waiting:         { MATCH_CREATED: 'matched', EXPIRE: 'expired', CANCEL: 'cancelled' },
  matched:         { CONVERSATION_OPENED: 'in_conversation', ALL_MATCHES_EXPIRED: 'active', EXPIRE: 'expired', CANCEL: 'cancelled' },
  in_conversation: { OFFER_STAGE_STARTED: 'in_negotiation', CONVERSATION_CLOSED: 'matched', EXPIRE: 'expired', CANCEL: 'cancelled' },
  in_negotiation:  { ORDER_CREATED_FULFILLED: 'fulfilled', OFFER_FAILED: 'in_conversation', EXPIRE: 'expired', CANCEL: 'cancelled' },
  fulfilled:       {},
  expired:         {},
  cancelled:       {},
}

export function transitionDemand(current: DemandStatus, event: DemandEvent): DemandStatus {
  const next = DEMAND_TRANSITIONS[current]?.[event]
  if (!next) throw new Error(`Invalid demand transition: ${current} + ${event}`)
  return next
}
```

---

## lib/state-machines/listing.ts

```typescript
type ListingStatus =
  | 'draft' | 'active' | 'matched' | 'in_conversation'
  | 'partially_sold' | 'sold' | 'expired' | 'removed'

type ListingEvent =
  | 'PUBLISH' | 'MATCH_CREATED' | 'CONVERSATION_OPENED'
  | 'CONVERSATION_CLOSED' | 'ORDER_PARTIAL' | 'QUANTITY_ZERO'
  | 'EXPIRE' | 'REMOVE'

const LISTING_TRANSITIONS: Record<ListingStatus, Partial<Record<ListingEvent, ListingStatus>>> = {
  draft:           { PUBLISH: 'active' },
  active:          { MATCH_CREATED: 'matched', ORDER_PARTIAL: 'partially_sold', QUANTITY_ZERO: 'sold', EXPIRE: 'expired', REMOVE: 'removed' },
  matched:         { CONVERSATION_OPENED: 'in_conversation', ORDER_PARTIAL: 'partially_sold', QUANTITY_ZERO: 'sold', EXPIRE: 'expired', REMOVE: 'removed' },
  in_conversation: { CONVERSATION_CLOSED: 'matched', ORDER_PARTIAL: 'partially_sold', QUANTITY_ZERO: 'sold', EXPIRE: 'expired', REMOVE: 'removed' },
  partially_sold:  { QUANTITY_ZERO: 'sold', EXPIRE: 'expired', REMOVE: 'removed' },
  sold:            { PUBLISH: 'active' },   // relist with new quantity
  expired:         { PUBLISH: 'active' },   // renew
  removed:         {},
}

export function transitionListing(current: ListingStatus, event: ListingEvent): ListingStatus {
  const next = LISTING_TRANSITIONS[current]?.[event]
  if (!next) throw new Error(`Invalid listing transition: ${current} + ${event}`)
  return next
}
```

---

## lib/state-machines/match.ts

```typescript
type MatchStatus =
  | 'proposed' | 'buyer_confirmed' | 'seller_confirmed'
  | 'active' | 'closed_success' | 'closed_failed' | 'expired'

type MatchEvent =
  | 'BUYER_ACK' | 'SELLER_ACK' | 'BOTH_ACK'
  | 'AUTO_OPEN' | 'ORDER_CREATED' | 'ABANDONED' | 'EXPIRE'

const MATCH_TRANSITIONS: Record<MatchStatus, Partial<Record<MatchEvent, MatchStatus>>> = {
  proposed:         { BUYER_ACK: 'buyer_confirmed', SELLER_ACK: 'seller_confirmed', AUTO_OPEN: 'active', EXPIRE: 'expired' },
  buyer_confirmed:  { SELLER_ACK: 'active', BOTH_ACK: 'active', EXPIRE: 'expired' },
  seller_confirmed: { BUYER_ACK: 'active', BOTH_ACK: 'active', EXPIRE: 'expired' },
  active:           { ORDER_CREATED: 'closed_success', ABANDONED: 'closed_failed', EXPIRE: 'expired' },
  closed_success:   {},
  closed_failed:    {},
  expired:          {},
}

export function transitionMatch(current: MatchStatus, event: MatchEvent): MatchStatus {
  const next = MATCH_TRANSITIONS[current]?.[event]
  if (!next) throw new Error(`Invalid match transition: ${current} + ${event}`)
  return next
}
```

---

## lib/state-machines/conversation.ts

```typescript
type ConversationStage  = 'verification' | 'clarification' | 'negotiation' | 'closed'
type ConversationEvent  = 'PROOF_SATISFIED' | 'OFFER_INITIATED' | 'DEAL_DONE' | 'ABANDON' | 'INACTIVITY' | 'ADMIN_CLOSE'

const CONVERSATION_TRANSITIONS: Record<ConversationStage, Partial<Record<ConversationEvent, ConversationStage>>> = {
  verification:  { PROOF_SATISFIED: 'clarification', ABANDON: 'closed', INACTIVITY: 'closed', ADMIN_CLOSE: 'closed' },
  clarification: { OFFER_INITIATED: 'negotiation', ABANDON: 'closed', INACTIVITY: 'closed', ADMIN_CLOSE: 'closed' },
  negotiation:   { DEAL_DONE: 'closed', ABANDON: 'closed', INACTIVITY: 'closed', ADMIN_CLOSE: 'closed' },
  closed:        {},
}

export function transitionConversation(current: ConversationStage, event: ConversationEvent): ConversationStage {
  const next = CONVERSATION_TRANSITIONS[current]?.[event]
  if (!next) throw new Error(`Invalid conversation transition: ${current} + ${event}`)
  return next
}
```

---

## Usage in API Route Handler

```typescript
import { transitionOffer } from '@/lib/state-machines/offer'
import { prisma } from '@/lib/prisma'

// POST /api/offers/[id]/accept
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth()
  const offer = await prisma.offer.findUniqueOrThrow({ where: { id: params.id } })

  // Will throw if transition is invalid (e.g., offer is already accepted)
  const nextStatus = transitionOffer(offer.status as any, 'ACCEPT')

  await prisma.$transaction([
    prisma.offer.update({ where: { id: offer.id }, data: { status: nextStatus } }),
    prisma.order.create({ data: { offerId: offer.id, /* ... snapshot fields */ } }),
  ])

  return NextResponse.json({ success: true })
}
```
