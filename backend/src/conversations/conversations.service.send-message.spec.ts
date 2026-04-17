/**
 * ConversationsService — sendMessage unit tests.
 * Verifies persistence fields, gateway emission, rate limiting, and access control.
 * No real database required — PrismaService is fully mocked.
 */

import { Test, TestingModule }                     from '@nestjs/testing'
import { ForbiddenException, UnprocessableEntityException } from '@nestjs/common'

import { ConversationsService }  from './conversations.service'
import { ConversationsGateway }  from './conversations.gateway'
import { PrismaService }         from '../prisma/prisma.service'
import { NotificationsService }  from '../notifications/notifications.service'
import { UploadService }         from '../upload/upload.service'
import {
  CONV_ID, BUYER_ID, SELLER_ID, activeConv, makeMsg,
} from './test/message.factory'

describe('ConversationsService – sendMessage', () => {
  let service: ConversationsService

  const mockPrisma = {
    conversation:     { findUnique: jest.fn(), update: jest.fn() },
    message:          { create: jest.fn(), count: jest.fn()      },
    matchInteraction: { count: jest.fn(), create: jest.fn()      },
  }
  const mockNotifications = { notify: jest.fn() }
  const mockUpload        = { getSignedUrl: jest.fn() }
  const mockGateway       = { emit: jest.fn() }

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: PrismaService,        useValue: mockPrisma        },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: UploadService,        useValue: mockUpload        },
        { provide: ConversationsGateway, useValue: mockGateway       },
      ],
    }).compile()

    service = module.get(ConversationsService)
  })

  // ── Teardown after every test ─────────────────────────────────────────────

  afterEach(() => {
    jest.clearAllMocks()
    // Restore defaults for tests that rely on these without explicit setup
    mockPrisma.message.count.mockResolvedValue(0)
    mockPrisma.matchInteraction.count.mockResolvedValue(0)
    mockPrisma.matchInteraction.create.mockResolvedValue({})
    mockNotifications.notify.mockResolvedValue(undefined)
    mockGateway.emit.mockReturnValue(undefined)
  })

  // ── Field correctness ─────────────────────────────────────────────────────

  it('calls prisma.message.create with the correct fields', async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue(activeConv)
    mockPrisma.conversation.update.mockResolvedValue(activeConv)
    mockPrisma.message.create.mockResolvedValue(makeMsg({ body: 'Hello service' }))

    await service.sendMessage(BUYER_ID, CONV_ID, { messageType: 'text', body: 'Hello service' })

    expect(mockPrisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conversationId: CONV_ID,
          senderUserId:   BUYER_ID,
          messageType:    'text',
          body:           'Hello service',
        }),
      }),
    )
  })

  it('emits new_message via the gateway after persisting', async () => {
    const msg = makeMsg({ id: 'emit-test-msg' })
    mockPrisma.conversation.findUnique.mockResolvedValue(activeConv)
    mockPrisma.conversation.update.mockResolvedValue(activeConv)
    mockPrisma.message.create.mockResolvedValue(msg)

    await service.sendMessage(BUYER_ID, CONV_ID, { messageType: 'text', body: msg.body })

    expect(mockGateway.emit).toHaveBeenCalledWith(CONV_ID, 'new_message', msg)
  })

  it('updates lastActivityAt on the conversation after sending', async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue(activeConv)
    mockPrisma.conversation.update.mockResolvedValue(activeConv)
    mockPrisma.message.create.mockResolvedValue(makeMsg())

    await service.sendMessage(BUYER_ID, CONV_ID, { messageType: 'text', body: 'hi' })

    expect(mockPrisma.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CONV_ID },
        data:  expect.objectContaining({ lastActivityAt: expect.any(Date) }),
      }),
    )
  })

  // ── Ordering: multiple messages ───────────────────────────────────────────

  it('sends 5 messages → gateway emits 5 times in the correct order', async () => {
    const bodies = ['msg-1', 'msg-2', 'msg-3', 'msg-4', 'msg-5']

    for (const body of bodies) {
      mockPrisma.conversation.findUnique.mockResolvedValueOnce(activeConv)
      mockPrisma.conversation.update.mockResolvedValueOnce(activeConv)
      mockPrisma.message.create.mockResolvedValueOnce(makeMsg({ body }))
      await service.sendMessage(BUYER_ID, CONV_ID, { messageType: 'text', body })
    }

    expect(mockGateway.emit).toHaveBeenCalledTimes(bodies.length)
    bodies.forEach((body, i) =>
      expect(mockGateway.emit).toHaveBeenNthCalledWith(
        i + 1, CONV_ID, 'new_message', expect.objectContaining({ body }),
      ),
    )
  })

  it('messages from buyer and seller are emitted with the correct senderUserId', async () => {
    const conversation = [
      { body: 'Hello!',    sender: BUYER_ID  },
      { body: 'Hi there!', sender: SELLER_ID },
      { body: 'How much?', sender: BUYER_ID  },
      { body: '500 000 ₫', sender: SELLER_ID },
    ]

    for (const { body, sender } of conversation) {
      mockPrisma.conversation.findUnique.mockResolvedValueOnce(activeConv)
      mockPrisma.conversation.update.mockResolvedValueOnce(activeConv)
      mockPrisma.message.create.mockResolvedValueOnce(makeMsg({ body, senderUserId: sender }))
      await service.sendMessage(sender, CONV_ID, { messageType: 'text', body })
    }

    expect(mockGateway.emit).toHaveBeenCalledTimes(conversation.length)
    conversation.forEach(({ body, sender }, i) =>
      expect(mockGateway.emit).toHaveBeenNthCalledWith(
        i + 1, CONV_ID, 'new_message',
        expect.objectContaining({ body, senderUserId: sender }),
      ),
    )
  })

  // ── Access control ────────────────────────────────────────────────────────

  it('throws ForbiddenException when the user is not a participant', async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue(activeConv)

    await expect(
      service.sendMessage('outsider-uuid', CONV_ID, { messageType: 'text', body: 'Hi' }),
    ).rejects.toThrow(ForbiddenException)

    expect(mockPrisma.message.create).not.toHaveBeenCalled()
  })

  it('throws when the conversation is closed', async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue({ ...activeConv, status: 'closed' })

    await expect(
      service.sendMessage(BUYER_ID, CONV_ID, { messageType: 'text', body: 'Hi' }),
    ).rejects.toThrow(UnprocessableEntityException)

    expect(mockPrisma.message.create).not.toHaveBeenCalled()
  })

  // ── Rate limiting ─────────────────────────────────────────────────────────

  it('allows exactly 20 messages in an hour (boundary — last allowed)', async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue(activeConv)
    mockPrisma.conversation.update.mockResolvedValue(activeConv)
    mockPrisma.message.count.mockResolvedValue(19) // one below limit
    mockPrisma.message.create.mockResolvedValue(makeMsg())

    await expect(
      service.sendMessage(BUYER_ID, CONV_ID, { messageType: 'text', body: 'Last allowed' }),
    ).resolves.toBeDefined()
  })

  it('rejects the 21st message in the same hour', async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue(activeConv)
    mockPrisma.message.count.mockResolvedValue(20) // at the limit

    await expect(
      service.sendMessage(BUYER_ID, CONV_ID, { messageType: 'text', body: 'Too many' }),
    ).rejects.toBeDefined()

    expect(mockPrisma.message.create).not.toHaveBeenCalled()
  })
})
