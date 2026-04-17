/**
 * ConversationsService — findOne unit tests.
 * Verifies that the query requests ascending createdAt ordering and that the
 * service returns messages exactly as the database provides them.
 */

import { Test, TestingModule }  from '@nestjs/testing'
import { ForbiddenException }   from '@nestjs/common'

import { ConversationsService } from './conversations.service'
import { ConversationsGateway } from './conversations.gateway'
import { PrismaService }        from '../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { UploadService }        from '../upload/upload.service'
import {
  CONV_ID, BUYER_ID, activeConv,
  makeMsg, makeConvPayload, makeMsgSequence,
} from './test/message.factory'

describe('ConversationsService – findOne (message ordering)', () => {
  let service: ConversationsService

  const mockPrisma = {
    conversation: { findUnique: jest.fn(), update: jest.fn() },
    message:      { create: jest.fn(), count: jest.fn()      },
  }

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: PrismaService,        useValue: mockPrisma                    },
        { provide: NotificationsService, useValue: { notify: jest.fn() }        },
        { provide: UploadService,        useValue: { getSignedUrl: jest.fn() }  },
        { provide: ConversationsGateway, useValue: { emit: jest.fn() }          },
      ],
    }).compile()

    service = module.get(ConversationsService)
  })

  // ── Teardown after every test ─────────────────────────────────────────────

  afterEach(() => jest.clearAllMocks())

  // ── Query shape ───────────────────────────────────────────────────────────

  it('queries messages with orderBy: { createdAt: "asc" }', async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue(makeConvPayload([]))

    await service.findOne(BUYER_ID, CONV_ID)

    expect(mockPrisma.conversation.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          messages: expect.objectContaining({
            orderBy: { createdAt: 'asc' },
          }),
        }),
      }),
    )
  })

  // ── Message ordering ──────────────────────────────────────────────────────

  it('returns messages in ascending order when DB returns them that way', async () => {
    const now  = Date.now()
    const msgs = [
      makeMsg({ id: 'm1', createdAt: new Date(now),        body: 'first'  }),
      makeMsg({ id: 'm2', createdAt: new Date(now + 1000), body: 'second' }),
      makeMsg({ id: 'm3', createdAt: new Date(now + 2000), body: 'third'  }),
    ]
    mockPrisma.conversation.findUnique.mockResolvedValue(makeConvPayload(msgs))

    const result = await service.findOne(BUYER_ID, CONV_ID) as any

    expect(result.messages.map((m: any) => m.body)).toEqual(['first', 'second', 'third'])
  })

  it('system message with the earliest createdAt appears before user messages', async () => {
    const now  = Date.now()
    const msgs = [
      makeMsg({
        id:                'sys',
        createdAt:         new Date(now),
        body:              'Conversation opened.',
        isSystemGenerated: true,
        messageType:       'system',
      }),
      makeMsg({ id: 'u1', createdAt: new Date(now + 1_000), body: 'Hey!'         }),
      makeMsg({ id: 'u2', createdAt: new Date(now + 2_000), body: 'How are you?' }),
    ]
    mockPrisma.conversation.findUnique.mockResolvedValue(makeConvPayload(msgs))

    const result = await service.findOne(BUYER_ID, CONV_ID) as any
    const first  = result.messages[0]

    expect(first.id).toBe('sys')
    expect(first.isSystemGenerated).toBe(true)
    expect(first.messageType).toBe('system')
  })

  it('returns all N messages for a high-volume conversation without dropping any', async () => {
    const N    = 20
    const msgs = makeMsgSequence(N)
    mockPrisma.conversation.findUnique.mockResolvedValue(makeConvPayload(msgs))

    const result = await service.findOne(BUYER_ID, CONV_ID) as any

    expect(result.messages).toHaveLength(N)
    expect(new Set(result.messages.map((m: any) => m.id)).size).toBe(N)
  })

  it('preserves body content for every message in a long conversation', async () => {
    const msgs = makeMsgSequence(10)
    mockPrisma.conversation.findUnique.mockResolvedValue(makeConvPayload(msgs))

    const result = await service.findOne(BUYER_ID, CONV_ID) as any

    result.messages.forEach((m: any, i: number) => {
      expect(m.body).toBe(`message-${i}`)
    })
  })

  // ── Access control ────────────────────────────────────────────────────────

  it('throws NotFoundException when conversation does not exist', async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue(null)

    await expect(service.findOne(BUYER_ID, 'nonexistent')).rejects.toThrow('Conversation not found')
  })

  it('throws ForbiddenException when user is not a participant', async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue(makeConvPayload([]))

    await expect(service.findOne('outsider-uuid', CONV_ID)).rejects.toThrow(ForbiddenException)
  })
})
