import {
  DemandStatus,
  ListingStatus,
  MatchStatus,
  ConversationStage,
  OfferStatus,
  OrderStatus,
} from '@prisma/client'
import { UnprocessableEntityException } from '@nestjs/common'

// ─── DEMAND ───────────────────────────────────────────────────────────────────

const DEMAND_TRANSITIONS: Record<DemandStatus, DemandStatus[]> = {
  draft:           ['active'],
  active:          ['waiting', 'matched', 'expired', 'cancelled'],
  waiting:         ['matched', 'expired', 'cancelled'],
  matched:         ['in_conversation', 'active', 'expired', 'cancelled'],
  in_conversation: ['in_negotiation', 'matched', 'expired', 'cancelled'],
  in_negotiation:  ['fulfilled', 'in_conversation', 'expired', 'cancelled'],
  fulfilled:       [],
  expired:         [],
  cancelled:       [],
}

export function transitionDemand(from: DemandStatus, to: DemandStatus): DemandStatus {
  if (!DEMAND_TRANSITIONS[from]?.includes(to)) {
    throw new UnprocessableEntityException(
      `Demand cannot transition from '${from}' to '${to}'`,
    )
  }
  return to
}

// ─── LISTING ──────────────────────────────────────────────────────────────────

const LISTING_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  draft:          ['active', 'removed'],
  active:         ['matched', 'partially_sold', 'sold', 'expired', 'removed'],
  matched:        ['in_conversation', 'partially_sold', 'sold', 'expired', 'removed'],
  in_conversation:['partially_sold', 'sold', 'active', 'expired', 'removed'],
  partially_sold: ['sold', 'expired', 'removed'],
  sold:           ['active'],  // relist
  expired:        ['active'],  // renew
  removed:        [],
}

export function transitionListing(from: ListingStatus, to: ListingStatus): ListingStatus {
  if (!LISTING_TRANSITIONS[from]?.includes(to)) {
    throw new UnprocessableEntityException(
      `Listing cannot transition from '${from}' to '${to}'`,
    )
  }
  return to
}

// ─── MATCH ────────────────────────────────────────────────────────────────────

const MATCH_TRANSITIONS: Record<MatchStatus, MatchStatus[]> = {
  proposed:         ['buyer_confirmed', 'seller_confirmed', 'active', 'expired'],
  buyer_confirmed:  ['active', 'expired'],
  seller_confirmed: ['active', 'expired'],
  active:           ['closed_success', 'closed_failed', 'expired'],
  closed_success:   [],
  closed_failed:    [],
  expired:          [],
}

export function transitionMatch(from: MatchStatus, to: MatchStatus): MatchStatus {
  if (!MATCH_TRANSITIONS[from]?.includes(to)) {
    throw new UnprocessableEntityException(
      `Match cannot transition from '${from}' to '${to}'`,
    )
  }
  return to
}

// ─── CONVERSATION STAGE ───────────────────────────────────────────────────────

const STAGE_TRANSITIONS: Record<ConversationStage, ConversationStage[]> = {
  verification:  ['clarification', 'closed'],
  clarification: ['negotiation', 'closed'],
  negotiation:   ['closed'],
  closed:        [],
}

export function transitionConversationStage(
  from: ConversationStage,
  to: ConversationStage,
): ConversationStage {
  if (!STAGE_TRANSITIONS[from]?.includes(to)) {
    throw new UnprocessableEntityException(
      `Conversation cannot advance from '${from}' to '${to}'`,
    )
  }
  return to
}

export function nextConversationStage(current: ConversationStage): ConversationStage {
  const map: Partial<Record<ConversationStage, ConversationStage>> = {
    verification:  'clarification',
    clarification: 'negotiation',
    negotiation:   'closed',
  }
  const next = map[current]
  if (!next) throw new UnprocessableEntityException(`No next stage after '${current}'`)
  return next
}

// ─── OFFER ────────────────────────────────────────────────────────────────────

const OFFER_TRANSITIONS: Record<OfferStatus, OfferStatus[]> = {
  draft:     ['pending'],
  pending:   ['accepted', 'rejected', 'countered', 'expired', 'cancelled'],
  countered: [],
  accepted:  [],
  rejected:  [],
  expired:   [],
  cancelled: [],
}

export function transitionOffer(from: OfferStatus, to: OfferStatus): OfferStatus {
  if (!OFFER_TRANSITIONS[from]?.includes(to)) {
    throw new UnprocessableEntityException(
      `Offer cannot transition from '${from}' to '${to}'`,
    )
  }
  return to
}

// ─── ORDER ────────────────────────────────────────────────────────────────────

const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  created:     ['confirmed', 'cancelled'],
  confirmed:   ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled', 'disputed'],
  completed:   ['disputed'],
  cancelled:   [],
  disputed:    [],
}

export function transitionOrder(from: OrderStatus, to: OrderStatus): OrderStatus {
  if (!ORDER_TRANSITIONS[from]?.includes(to)) {
    throw new UnprocessableEntityException(
      `Order cannot transition from '${from}' to '${to}'`,
    )
  }
  return to
}
