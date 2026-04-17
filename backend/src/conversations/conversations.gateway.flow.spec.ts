/**
 * Gateway — full order-request lifecycle flow.
 * Simulates the complete buyer ↔ seller sequence from order creation to
 * order completion, verifying that both parties receive every event.
 */

import { Socket } from 'socket.io-client'
import {
  createGatewayApp, teardown,
  makeToken, openSocket, waitForConnect, emitWithAck, waitForEvent,
  type GatewayCtx,
} from './test/gateway-setup'

describe('ConversationsGateway – full order-request flow', () => {
  let ctx: GatewayCtx

  beforeAll(async () => { ctx = await createGatewayApp() })
  afterAll(async ()  => { await teardown(ctx) })
  afterEach(()       => { jest.clearAllMocks() })

  it('buyer and seller both receive all lifecycle events in the correct sequence', async () => {
    const BUYER  = 'flow-buyer-uuid'
    const SELLER = 'flow-seller-uuid'
    const CONV   = 'flow-conv-uuid'

    ctx.mockPrisma.conversation.findUnique.mockResolvedValue({
      id: CONV, buyerUserId: BUYER, sellerUserId: SELLER,
    })

    const buyerSocket:  Socket = openSocket(ctx.port, makeToken(ctx.jwtService, BUYER))
    const sellerSocket: Socket = openSocket(ctx.port, makeToken(ctx.jwtService, SELLER))
    ctx.sockets.push(buyerSocket, sellerSocket)

    await Promise.all([waitForConnect(buyerSocket), waitForConnect(sellerSocket)])
    await Promise.all([
      emitWithAck(buyerSocket,  'join_conversation', CONV),
      emitWithAck(sellerSocket, 'join_conversation', CONV),
    ])

    // ── Step 1: buyer initiates order request ────────────────────────────────
    const orPayload = { id: 'or-1', status: 'pending', conversationId: CONV }

    const [b1, s1] = await Promise.all([
      waitForEvent(buyerSocket,  'order_request_created'),
      waitForEvent(sellerSocket, 'order_request_created'),
      Promise.resolve().then(() => ctx.gateway.emit(CONV, 'order_request_created', orPayload)),
    ])
    expect(b1).toEqual(orPayload)
    expect(s1).toEqual(orPayload)

    // ── Step 2: seller accepts ───────────────────────────────────────────────
    const acceptedPayload = { ...orPayload, status: 'accepted' }

    const [b2, s2] = await Promise.all([
      waitForEvent(buyerSocket,  'order_request_updated'),
      waitForEvent(sellerSocket, 'order_request_updated'),
      Promise.resolve().then(() => ctx.gateway.emit(CONV, 'order_request_updated', acceptedPayload)),
    ])
    expect((b2 as any).status).toBe('accepted')
    expect((s2 as any).status).toBe('accepted')

    // ── Step 3: seller fills price ───────────────────────────────────────────
    const sellerFilledPayload = { ...orPayload, status: 'seller_filled', price: 17_500_000 }

    const [b3, s3] = await Promise.all([
      waitForEvent(buyerSocket,  'order_request_updated'),
      waitForEvent(sellerSocket, 'order_request_updated'),
      Promise.resolve().then(() => ctx.gateway.emit(CONV, 'order_request_updated', sellerFilledPayload)),
    ])
    expect((b3 as any).status).toBe('seller_filled')
    expect((s3 as any).status).toBe('seller_filled')

    // ── Step 4: buyer fills delivery info → order created ────────────────────
    const orderCreatedPayload = { orderId: 'order-flow-uuid' }

    const [b4, s4] = await Promise.all([
      waitForEvent(buyerSocket,  'order_created'),
      waitForEvent(sellerSocket, 'order_created'),
      Promise.resolve().then(() => ctx.gateway.emit(CONV, 'order_created', orderCreatedPayload)),
    ])
    expect(b4).toEqual(orderCreatedPayload)
    expect(s4).toEqual(orderCreatedPayload)

    buyerSocket.disconnect()
    sellerSocket.disconnect()
  })
})
