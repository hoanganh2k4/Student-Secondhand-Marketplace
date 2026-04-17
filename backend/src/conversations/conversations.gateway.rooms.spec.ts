/**
 * Gateway — room management tests.
 * Verifies join_conversation ACKs and that events are isolated per room.
 */

import {
  createGatewayApp, teardown, joinRoom,
  makeToken, openSocket, waitForConnect, emitWithAck, waitForEvent,
  type GatewayCtx,
} from './test/gateway-setup'

describe('ConversationsGateway – rooms', () => {
  let ctx: GatewayCtx

  beforeAll(async () => { ctx = await createGatewayApp() })
  afterAll(async ()  => { await teardown(ctx) })
  afterEach(()       => { jest.clearAllMocks() })

  // ── join_conversation ACKs ────────────────────────────────────────────────

  describe('join_conversation', () => {
    const BUYER_ID  = 'join-buyer-uuid'
    const SELLER_ID = 'join-seller-uuid'
    const CONV_ID   = 'join-conv-uuid'
    const fakeConv  = { id: CONV_ID, buyerUserId: BUYER_ID, sellerUserId: SELLER_ID }

    it('returns { ok: true } when the buyer joins', async () => {
      ctx.mockPrisma.conversation.findUnique.mockResolvedValue(fakeConv)
      const s = openSocket(ctx.port, makeToken(ctx.jwtService, BUYER_ID))
      ctx.sockets.push(s)
      await waitForConnect(s)

      expect(await emitWithAck(s, 'join_conversation', CONV_ID)).toEqual({ ok: true })
      s.disconnect()
    })

    it('returns { ok: true } when the seller joins', async () => {
      ctx.mockPrisma.conversation.findUnique.mockResolvedValue(fakeConv)
      const s = openSocket(ctx.port, makeToken(ctx.jwtService, SELLER_ID))
      ctx.sockets.push(s)
      await waitForConnect(s)

      expect(await emitWithAck(s, 'join_conversation', CONV_ID)).toEqual({ ok: true })
      s.disconnect()
    })

    it('returns { error: "Access denied" } when conversation does not exist', async () => {
      ctx.mockPrisma.conversation.findUnique.mockResolvedValue(null)
      const s = openSocket(ctx.port, makeToken(ctx.jwtService, BUYER_ID))
      ctx.sockets.push(s)
      await waitForConnect(s)

      expect(await emitWithAck(s, 'join_conversation', 'nonexistent')).toEqual({ error: 'Access denied' })
      s.disconnect()
    })

    it('returns { error: "Access denied" } when user is not a participant', async () => {
      ctx.mockPrisma.conversation.findUnique.mockResolvedValue(fakeConv)
      const s = openSocket(ctx.port, makeToken(ctx.jwtService, 'outsider-uuid'))
      ctx.sockets.push(s)
      await waitForConnect(s)

      expect(await emitWithAck(s, 'join_conversation', CONV_ID)).toEqual({ error: 'Access denied' })
      s.disconnect()
    })
  })

  // ── Room isolation ────────────────────────────────────────────────────────

  describe('room isolation', () => {
    const BUYER_A  = 'iso-buyer-a'
    const SELLER_A = 'iso-seller-a'
    const CONV_A   = 'iso-conv-a'
    const CONV_B   = 'iso-conv-b'
    const convA    = { id: CONV_A, buyerUserId: BUYER_A, sellerUserId: SELLER_A }
    const convB    = { id: CONV_B, buyerUserId: 'other-buyer', sellerUserId: 'other-seller' }

    it('does NOT deliver events to a client in a different room', async () => {
      ctx.mockPrisma.conversation.findUnique.mockImplementation(({ where }: any) =>
        Promise.resolve(where.id === CONV_A ? convA : convB),
      )

      const participant = await joinRoom(ctx, BUYER_A,       CONV_A, convA)
      const outsider    = await joinRoom(ctx, 'other-buyer', CONV_B, convB)

      const msg = { id: 'iso-msg', body: 'Private', conversationId: CONV_A }

      const outsiderRace = Promise.race<string>([
        waitForEvent(outsider, 'new_message').then(() => 'received'),
        new Promise(r => setTimeout(() => r('not-received'), 500)),
      ])

      ctx.gateway.emit(CONV_A, 'new_message', msg)
      expect(await outsiderRace).toBe('not-received')

      participant.disconnect()
      outsider.disconnect()
    })

    it('delivers events only to clients that have joined the room', async () => {
      ctx.mockPrisma.conversation.findUnique.mockResolvedValue(convA)

      const joined  = await joinRoom(ctx, BUYER_A, CONV_A, convA)

      // Second client connects but does NOT join any room
      const s = openSocket(ctx.port, makeToken(ctx.jwtService, SELLER_A))
      ctx.sockets.push(s)
      await waitForConnect(s)

      const msg = { id: 'join-check', body: 'Only for room members' }

      const notJoinedRace = Promise.race<string>([
        waitForEvent(s, 'new_message').then(() => 'received'),
        new Promise(r => setTimeout(() => r('not-received'), 400)),
      ])

      ctx.gateway.emit(CONV_A, 'new_message', msg)
      expect(await notJoinedRace).toBe('not-received')

      joined.disconnect()
      s.disconnect()
    })
  })
})
