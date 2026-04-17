/**
 * Shared fixtures for ConversationsService unit tests.
 */

export const CONV_ID   = 'svc-conv-uuid'
export const BUYER_ID  = 'svc-buyer-uuid'
export const SELLER_ID = 'svc-seller-uuid'
export const MATCH_ID  = 'svc-match-uuid'

export const activeConv = {
  id:           CONV_ID,
  buyerUserId:  BUYER_ID,
  sellerUserId: SELLER_ID,
  status:       'active',
  matchId:      MATCH_ID,
  stage:        'verification',
}

/** Build a minimal Message object. All optional fields default sensibly. */
export function makeMsg(overrides: Partial<{
  id:                string
  conversationId:    string
  senderUserId:      string
  messageType:       string
  body:              string
  createdAt:         Date
  isSystemGenerated: boolean
  sender:            { id: string; name: string }
}> = {}) {
  return {
    id:                overrides.id                ?? `msg-${Math.random().toString(36).slice(2)}`,
    conversationId:    overrides.conversationId    ?? CONV_ID,
    senderUserId:      overrides.senderUserId      ?? BUYER_ID,
    messageType:       overrides.messageType       ?? 'text',
    body:              overrides.body              ?? 'Hello',
    mediaKey:          null,
    mediaUrl:          null,
    isSystemGenerated: overrides.isSystemGenerated ?? false,
    createdAt:         overrides.createdAt         ?? new Date(),
    sender:            overrides.sender            ?? { id: BUYER_ID, name: 'Test Buyer' },
  }
}

/** Build a full findOne-style conversation payload (all includes present). */
export function makeConvPayload(msgs: ReturnType<typeof makeMsg>[]) {
  return {
    ...activeConv,
    match: {
      demandRequest:  { category: {} },
      productListing: { category: {}, proofAssets: [] },
    },
    messages:         msgs,
    evidenceRequests: [],
    offers:           [],
    orderRequests:    [],
  }
}

/** Build a set of N messages with ascending createdAt timestamps. */
export function makeMsgSequence(n: number, baseTime = Date.now()) {
  return Array.from({ length: n }, (_, i) =>
    makeMsg({
      id:        `seq-msg-${i}`,
      body:      `message-${i}`,
      createdAt: new Date(baseTime + i * 100),
    }),
  )
}
