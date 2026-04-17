/**
 * Gateway — message delivery tests.
 * Verifies that messages are delivered to room participants in the correct
 * order, without loss, and that both buyer and seller receive the same sequence.
 */

import { Socket } from 'socket.io-client'
import {
  createGatewayApp, teardown, joinRoom, waitForEvent,
  type GatewayCtx,
} from './test/gateway-setup'

describe('ConversationsGateway – message delivery', () => {
  let ctx: GatewayCtx

  const BUYER_ID  = 'msg-buyer-uuid'
  const SELLER_ID = 'msg-seller-uuid'
  const CONV_ID   = 'msg-conv-uuid'
  const fakeConv  = { id: CONV_ID, buyerUserId: BUYER_ID, sellerUserId: SELLER_ID }

  let buyer:  Socket
  let seller: Socket

  beforeAll(async () => { ctx = await createGatewayApp() })
  afterAll(async ()  => { await teardown(ctx) })

  beforeEach(async () => {
    ctx.mockPrisma.conversation.findUnique.mockResolvedValue(fakeConv)
    buyer  = await joinRoom(ctx, BUYER_ID,  CONV_ID, fakeConv)
    seller = await joinRoom(ctx, SELLER_ID, CONV_ID, fakeConv)
  })

  afterEach(() => {
    // Teardown: disconnect sockets used in this test and clear mocks
    buyer?.disconnect()
    seller?.disconnect()
    jest.clearAllMocks()
  })

  it('delivers a single message to both buyer and seller', async () => {
    const msg = { id: 'single-msg', body: 'Hello!', conversationId: CONV_ID }

    const [buyerMsg, sellerMsg] = await Promise.all([
      waitForEvent<typeof msg>(buyer,  'new_message'),
      waitForEvent<typeof msg>(seller, 'new_message'),
      Promise.resolve().then(() => ctx.gateway.emit(CONV_ID, 'new_message', msg)),
    ])

    expect(buyerMsg).toEqual(msg)
    expect(sellerMsg).toEqual(msg)
  })

  it('delivers N messages in the exact order they were emitted', async () => {
    const N    = 8
    const msgs = Array.from({ length: N }, (_, i) => ({
      id:        `seq-${i}`,
      body:      `message-${i}`,
      createdAt: new Date(Date.now() + i * 100).toISOString(),
    }))

    const received: typeof msgs = []
    buyer.on('new_message', (m: any) => received.push(m))

    for (const msg of msgs) {
      await Promise.resolve().then(() => ctx.gateway.emit(CONV_ID, 'new_message', msg))
    }
    await new Promise(r => setTimeout(r, 200))

    expect(received).toHaveLength(N)
    received.forEach((m, i) => expect(m.id).toBe(`seq-${i}`))
  })

  it('buyer and seller receive the same sequence of messages', async () => {
    const N    = 5
    const msgs = Array.from({ length: N }, (_, i) => ({
      id: `both-${i}`, body: `shared-${i}`,
    }))

    const buyerReceived:  any[] = []
    const sellerReceived: any[] = []
    buyer.on('new_message',  (m: any) => buyerReceived.push(m))
    seller.on('new_message', (m: any) => sellerReceived.push(m))

    for (const msg of msgs) {
      await Promise.resolve().then(() => ctx.gateway.emit(CONV_ID, 'new_message', msg))
    }
    await new Promise(r => setTimeout(r, 200))

    expect(buyerReceived).toHaveLength(N)
    expect(sellerReceived).toHaveLength(N)
    expect(buyerReceived.map(m => m.id)).toEqual(sellerReceived.map(m => m.id))
  })

  it('interleaved messages from buyer and seller arrive in send order', async () => {
    const conversation = [
      { id: 'b1', senderUserId: BUYER_ID,  body: 'Hey!'      },
      { id: 's1', senderUserId: SELLER_ID, body: 'Hi!'       },
      { id: 'b2', senderUserId: BUYER_ID,  body: 'How much?' },
      { id: 's2', senderUserId: SELLER_ID, body: '500k'      },
      { id: 'b3', senderUserId: BUYER_ID,  body: 'Deal!'     },
    ]

    const buyerReceived:  any[] = []
    const sellerReceived: any[] = []
    buyer.on('new_message',  (m: any) => buyerReceived.push(m))
    seller.on('new_message', (m: any) => sellerReceived.push(m))

    for (const msg of conversation) {
      await Promise.resolve().then(() => ctx.gateway.emit(CONV_ID, 'new_message', msg))
    }
    await new Promise(r => setTimeout(r, 200))

    const expectedOrder = ['b1', 's1', 'b2', 's2', 'b3']
    expect(buyerReceived.map(m => m.id)).toEqual(expectedOrder)
    expect(sellerReceived.map(m => m.id)).toEqual(expectedOrder)
  })

  it('10 rapid-fire messages arrive without loss', async () => {
    const N    = 10
    const msgs = Array.from({ length: N }, (_, i) => ({
      id: `rapid-${i}`, body: `rapid-body-${i}`,
    }))

    const received: any[] = []
    buyer.on('new_message', (m: any) => received.push(m))

    // Emit all at once (no await between)
    msgs.forEach(msg => ctx.gateway.emit(CONV_ID, 'new_message', msg))
    await new Promise(r => setTimeout(r, 300))

    expect(received).toHaveLength(N)
    const receivedIds = new Set(received.map((m: any) => m.id))
    msgs.forEach(msg => expect(receivedIds.has(msg.id)).toBe(true))
  })

  it('delivers order_request_created, order_request_updated, and order_created', async () => {
    const orPayload    = { id: 'or-1', status: 'pending'  }
    const updPayload   = { id: 'or-1', status: 'accepted' }
    const donePayload  = { orderId: 'order-uuid' }

    const [bc, sc] = await Promise.all([
      waitForEvent(buyer,  'order_request_created'),
      waitForEvent(seller, 'order_request_created'),
      Promise.resolve().then(() => ctx.gateway.emit(CONV_ID, 'order_request_created', orPayload)),
    ])
    expect(bc).toEqual(orPayload)
    expect(sc).toEqual(orPayload)

    const [bu, su] = await Promise.all([
      waitForEvent(buyer,  'order_request_updated'),
      waitForEvent(seller, 'order_request_updated'),
      Promise.resolve().then(() => ctx.gateway.emit(CONV_ID, 'order_request_updated', updPayload)),
    ])
    expect(bu).toEqual(updPayload)
    expect(su).toEqual(updPayload)

    const [bd, sd] = await Promise.all([
      waitForEvent(buyer,  'order_created'),
      waitForEvent(seller, 'order_created'),
      Promise.resolve().then(() => ctx.gateway.emit(CONV_ID, 'order_created', donePayload)),
    ])
    expect(bd).toEqual(donePayload)
    expect(sd).toEqual(donePayload)
  })
})
