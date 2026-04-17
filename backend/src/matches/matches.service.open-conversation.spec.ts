/**
 * MatchesService — openConversation race-condition regression test.
 *
 * THE BUG (now fixed):
 *   The original code created the conversation and the system message in two
 *   separate `await` calls:
 *
 *     const conversation = await this.prisma.conversation.create({ ... })
 *     // ← 28-second window here: any user message sent now appears BEFORE
 *     //   the system message because it gets an earlier createdAt
 *     await this.prisma.message.create({ ... isSystemGenerated: true })
 *
 * THE FIX:
 *   Both rows are created atomically via Prisma nested create:
 *
 *     await this.prisma.conversation.create({
 *       data: { ..., messages: { create: { isSystemGenerated: true, ... } } }
 *     })
 *
 * WHAT THESE TESTS VERIFY:
 *   1. `prisma.conversation.create` is called with `messages.create` embedded
 *      — meaning the system message is part of the same DB transaction.
 *   2. `prisma.message.create` is NEVER called as a separate top-level call
 *      after conversation creation — if it were, the race window would exist again.
 */

import { Test, TestingModule }      from '@nestjs/testing'
import { NotFoundException }        from '@nestjs/common'

import { MatchesService }           from './matches.service'
import { PrismaService }            from '../prisma/prisma.service'
import { NotificationsService }     from '../notifications/notifications.service'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const MATCH_ID   = 'match-open-uuid'
const BUYER_UID  = 'buyer-user-uuid'
const SELLER_UID = 'seller-user-uuid'
const CONV_ID    = 'conv-open-uuid'

const buyerProfile  = { userId: BUYER_UID }
const sellerProfile = { userId: SELLER_UID }

/** A fully-acknowledged match — both sides have confirmed. */
const fullAcknowledgedMatch = {
  id:                  MATCH_ID,
  demandRequestId:     'dr-uuid',
  productListingId:    'pl-uuid',
  status:              'active',
  buyerAcknowledged:   true,
  sellerAcknowledged:  true,
  demandRequest:  { buyerProfile },
  productListing: { sellerProfile },
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('MatchesService – openConversation (race-condition regression)', () => {
  let service: MatchesService

  const mockPrisma = {
    match:        { findUnique: jest.fn(), update: jest.fn() },
    conversation: { findUnique: jest.fn(), create: jest.fn() },
    message:      { create: jest.fn() }, // must NOT be called separately
  }
  const mockNotifications = { notify: jest.fn() }

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchesService,
        { provide: PrismaService,        useValue: mockPrisma        },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile()

    service = module.get(MatchesService)
  })

  afterEach(() => {
    jest.clearAllMocks()
    mockNotifications.notify.mockResolvedValue(undefined)
  })

  // ── Core regression tests ─────────────────────────────────────────────────

  describe('atomic conversation + system message creation', () => {
    beforeEach(() => {
      mockPrisma.match.findUnique.mockResolvedValue(fullAcknowledgedMatch)
      mockPrisma.match.update.mockResolvedValue({ ...fullAcknowledgedMatch, status: 'active' })
      mockPrisma.conversation.findUnique.mockResolvedValue(null) // no existing conv
      mockPrisma.conversation.create.mockResolvedValue({ id: CONV_ID })
    })

    it('creates the system message INSIDE the conversation.create call (nested), not separately', async () => {
      await service.acknowledge(BUYER_UID, MATCH_ID)

      // The system message must be embedded in conversation.create via messages.create
      expect(mockPrisma.conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            messages: expect.objectContaining({
              create: expect.objectContaining({
                isSystemGenerated: true,
                messageType:       'system',
              }),
            }),
          }),
        }),
      )
    })

    it('NEVER calls prisma.message.create as a separate top-level call after conversation creation', async () => {
      await service.acknowledge(BUYER_UID, MATCH_ID)

      // If this assertion fails, the race window has been re-introduced:
      // a separate message.create means there is a gap between conversation
      // creation and system message insertion where user messages could arrive.
      expect(mockPrisma.message.create).not.toHaveBeenCalled()
    })

    it('system message body instructs participants to begin with the Verification stage', async () => {
      await service.acknowledge(BUYER_UID, MATCH_ID)

      const createCall = mockPrisma.conversation.create.mock.calls[0][0]
      const sysMsg     = createCall.data.messages.create

      expect(sysMsg.body).toMatch(/Verification/i)
    })

    it('system message has the correct senderUserId (buyerUserId)', async () => {
      await service.acknowledge(BUYER_UID, MATCH_ID)

      const createCall = mockPrisma.conversation.create.mock.calls[0][0]
      const sysMsg     = createCall.data.messages.create

      expect(sysMsg.senderUserId).toBe(BUYER_UID)
    })

    it('conversation.create is called exactly once (no duplicate conversations)', async () => {
      await service.acknowledge(BUYER_UID, MATCH_ID)

      expect(mockPrisma.conversation.create).toHaveBeenCalledTimes(1)
    })
  })

  // ── Guard: no new conversation if one already exists ─────────────────────

  describe('idempotency — skips if conversation already exists', () => {
    it('does NOT create a second conversation when one already exists for the match', async () => {
      mockPrisma.match.findUnique.mockResolvedValue(fullAcknowledgedMatch)
      mockPrisma.match.update.mockResolvedValue(fullAcknowledgedMatch)
      mockPrisma.conversation.findUnique.mockResolvedValue({ id: CONV_ID }) // already exists

      await service.acknowledge(BUYER_UID, MATCH_ID)

      expect(mockPrisma.conversation.create).not.toHaveBeenCalled()
      expect(mockPrisma.message.create).not.toHaveBeenCalled()
    })
  })

  // ── acknowledge state machine ─────────────────────────────────────────────

  describe('acknowledge — partial acknowledgement states', () => {
    it('sets status to buyer_confirmed when only the buyer has acknowledged', async () => {
      const match = {
        ...fullAcknowledgedMatch,
        buyerAcknowledged:  false,
        sellerAcknowledged: false,
      }
      mockPrisma.match.findUnique.mockResolvedValue(match)
      mockPrisma.match.update.mockResolvedValue(match)
      mockPrisma.conversation.findUnique.mockResolvedValue(null)

      await service.acknowledge(BUYER_UID, MATCH_ID)

      expect(mockPrisma.match.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ buyerAcknowledged: true, status: 'buyer_confirmed' }),
        }),
      )
      expect(mockPrisma.conversation.create).not.toHaveBeenCalled()
    })

    it('sets status to seller_confirmed when only the seller has acknowledged', async () => {
      const match = {
        ...fullAcknowledgedMatch,
        buyerAcknowledged:  false,
        sellerAcknowledged: false,
      }
      mockPrisma.match.findUnique.mockResolvedValue(match)
      mockPrisma.match.update.mockResolvedValue(match)
      mockPrisma.conversation.findUnique.mockResolvedValue(null)

      await service.acknowledge(SELLER_UID, MATCH_ID)

      expect(mockPrisma.match.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sellerAcknowledged: true, status: 'seller_confirmed' }),
        }),
      )
      expect(mockPrisma.conversation.create).not.toHaveBeenCalled()
    })

    it('opens a conversation when both sides acknowledge (buyer goes last)', async () => {
      // Seller already acknowledged, buyer is last
      const match = {
        ...fullAcknowledgedMatch,
        buyerAcknowledged:  false,
        sellerAcknowledged: true,
      }
      mockPrisma.match.findUnique.mockResolvedValue(match)
      mockPrisma.match.update.mockResolvedValue(match)
      mockPrisma.conversation.findUnique.mockResolvedValue(null)
      mockPrisma.conversation.create.mockResolvedValue({ id: CONV_ID })

      await service.acknowledge(BUYER_UID, MATCH_ID)

      expect(mockPrisma.conversation.create).toHaveBeenCalledTimes(1)
    })

    it('throws NotFoundException for a non-existent match', async () => {
      mockPrisma.match.findUnique.mockResolvedValue(null)

      await expect(service.acknowledge(BUYER_UID, 'nonexistent')).rejects.toThrow(NotFoundException)
    })
  })
})
