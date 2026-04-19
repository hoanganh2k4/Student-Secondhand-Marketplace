import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
  BadRequestException,
  HttpException,
  forwardRef,
  Inject,
} from '@nestjs/common'
import { PrismaService }        from '../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { UploadService }        from '../upload/upload.service'
import { nextConversationStage } from '../common/state-machines'
import {
  SendMessageDto,
  CreateEvidenceRequestDto,
  FulfillEvidenceRequestDto,
  CreateOrderRequestDto,
  SellerInfoDto,
  BuyerInfoDto,
} from './dto/conversations.dto'
import { ConversationsGateway } from './conversations.gateway'

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma:        PrismaService,
    private readonly notifications: NotificationsService,
    private readonly upload:        UploadService,
    @Inject(forwardRef(() => ConversationsGateway))
    private readonly gateway:       ConversationsGateway,
  ) {}

  // ─── LIST (INBOX) ──────────────────────────────────────────────────────────

  async list(userId: string) {
    return this.prisma.conversation.findMany({
      where: { OR: [{ buyerUserId: userId }, { sellerUserId: userId }] },
      include: {
        match: {
          include: {
            demandRequest:  { select: { title: true } },
            productListing: { select: { title: true } },
          },
        },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { lastActivityAt: 'desc' },
    })
  }

  // ─── GET ONE ──────────────────────────────────────────────────────────────

  async findOne(userId: string, id: string) {
    const conv = await this.prisma.conversation.findUnique({
      where:   { id },
      include: {
        match: {
          include: {
            demandRequest:  { include: { category: true } },
            productListing: { include: { category: true, proofAssets: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { sender: { select: { id: true, name: true } } },
        },
        evidenceRequests: { orderBy: { dueAt: 'asc' }, include: { proofAssets: true } },
        offers:           { orderBy: { createdAt: 'desc' }, take: 10 },
        orderRequests:    { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!conv) throw new NotFoundException('Conversation not found.')
    this.assertParticipant(userId, conv)
    return conv
  }

  // ─── SEND MESSAGE ─────────────────────────────────────────────────────────

  async sendMessage(userId: string, conversationId: string, dto: SendMessageDto) {
    const conv = await this.getActiveConv(userId, conversationId)

    if ((dto.messageType === 'image' || dto.messageType === 'video') && !dto.mediaKey) {
      throw new BadRequestException('mediaKey is required for image/video messages.')
    }

    // Rate limit: 20 messages per hour per user
    const oneHourAgo = new Date(Date.now() - 3_600_000)
    const count = await this.prisma.message.count({
      where: { conversationId, senderUserId: userId, createdAt: { gte: oneHourAgo } },
    })
    if (count >= 20) throw new HttpException('Rate limit reached: 20 messages per hour.', 429)

    let mediaUrl: string | undefined
    if (dto.mediaKey) {
      mediaUrl = await this.upload.getSignedUrl(dto.mediaKey, 3600 * 24 * 7)
    }

    const message = await this.prisma.message.create({
      data: { conversationId, senderUserId: userId, messageType: dto.messageType, body: dto.body, mediaKey: dto.mediaKey, mediaUrl },
      include: { sender: { select: { id: true, name: true } } },
    })

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data:  { lastActivityAt: new Date() },
    })

    // Push to WebSocket room
    this.gateway.emit(conversationId, 'new_message', message)

    // Notify the other participant
    const otherId = conv.buyerUserId === userId ? conv.sellerUserId : conv.buyerUserId
    await this.notifications.notify(otherId, 'new_message', dto.body.slice(0, 100), 'conversation', conversationId)

    // Log first-message interaction for LTR (fire-and-forget)
    if (conv.matchId) {
      const prior = await this.prisma.matchInteraction.count({
        where: { matchId: conv.matchId, userId, action: 'messaged' },
      })
      if (prior === 0) {
        this.prisma.matchInteraction.create({
          data: { matchId: conv.matchId, userId, action: 'messaged', surface: 'direct' },
        }).catch(() => null)
      }
    }

    return message
  }

  // ─── ADVANCE STAGE ────────────────────────────────────────────────────────

  async advanceStage(userId: string, conversationId: string) {
    const conv = await this.getActiveConv(userId, conversationId)

    if (conv.buyerUserId !== userId) {
      throw new ForbiddenException('Only the buyer can advance the stage.')
    }
    if (conv.stage === 'negotiation' || conv.stage === 'closed') {
      throw new UnprocessableEntityException(`Cannot advance from stage '${conv.stage}'.`)
    }

    const nextStage = nextConversationStage(conv.stage)
    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data:  { stage: nextStage, stageEnteredAt: new Date() },
    })

    const sysMsg = await this.prisma.message.create({
      data: {
        conversationId,
        senderUserId:      userId,
        messageType:       'system',
        body:              `Conversation advanced to ${nextStage} stage.`,
        isSystemGenerated: true,
      },
    })

    this.gateway.emit(conversationId, 'new_message', sysMsg)

    await this.notifications.notify(conv.sellerUserId, 'stage_advanced', `Conversation moved to ${nextStage} stage.`, 'conversation', conversationId)

    return updated
  }

  // ─── ORDER REQUESTS ────────────────────────────────────────────────────────

  async createOrderRequest(userId: string, conversationId: string, dto: CreateOrderRequestDto) {
    const conv = await this.getActiveConv(userId, conversationId)

    // Only one active order request at a time
    const existing = await this.prisma.orderRequest.findFirst({
      where: { conversationId, status: { in: ['pending', 'accepted', 'seller_filled', 'buyer_filled'] } },
    })
    if (existing) {
      throw new UnprocessableEntityException('There is already an active order request for this conversation.')
    }

    const orderRequest = await this.prisma.orderRequest.create({
      data: {
        conversationId,
        initiatedByUserId: userId,
        quantity:          dto.quantity ?? 1,
        status:            'pending',
      },
    })

    // System message
    const initiatorRole = conv.buyerUserId === userId ? 'Buyer' : 'Seller'
    const sysMsg = await this.prisma.message.create({
      data: {
        conversationId,
        senderUserId:      userId,
        messageType:       'system',
        body:              `__order_request:${orderRequest.id}__`,
        isSystemGenerated: true,
      },
    })

    this.gateway.emit(conversationId, 'new_message', sysMsg)
    this.gateway.emit(conversationId, 'order_request_created', { ...orderRequest, initiatorRole })

    const otherId = conv.buyerUserId === userId ? conv.sellerUserId : conv.buyerUserId
    await this.notifications.notify(otherId, 'order_request', `${initiatorRole} wants to create an order.`, 'conversation', conversationId)

    return orderRequest
  }

  async respondToOrderRequest(userId: string, requestId: string, action: 'accept' | 'reject') {
    const orderRequest = await this.prisma.orderRequest.findUnique({ where: { id: requestId } })
    if (!orderRequest) throw new NotFoundException('Order request not found.')

    const conv = await this.getActiveConv(userId, orderRequest.conversationId)

    // Only the other party can respond
    if (orderRequest.initiatedByUserId === userId) {
      throw new ForbiddenException('You cannot respond to your own order request.')
    }
    if (orderRequest.status !== 'pending') {
      throw new UnprocessableEntityException(`Order request is already ${orderRequest.status}.`)
    }

    const status = action === 'accept' ? 'accepted' : 'rejected'
    const updated = await this.prisma.orderRequest.update({
      where: { id: requestId },
      data:  { status },
    })

    this.gateway.emit(orderRequest.conversationId, 'order_request_updated', updated)

    const otherId = conv.buyerUserId === userId ? conv.sellerUserId : conv.buyerUserId
    await this.notifications.notify(otherId, `order_request_${action}`, `Order request was ${action}ed.`, 'conversation', orderRequest.conversationId)

    return updated
  }

  async fillSellerInfo(userId: string, requestId: string, dto: SellerInfoDto) {
    const orderRequest = await this.prisma.orderRequest.findUnique({ where: { id: requestId } })
    if (!orderRequest) throw new NotFoundException('Order request not found.')

    const conv = await this.getActiveConv(userId, orderRequest.conversationId)

    if (conv.sellerUserId !== userId) {
      throw new ForbiddenException('Only the seller can fill seller info.')
    }
    if (!['accepted', 'buyer_filled'].includes(orderRequest.status)) {
      throw new UnprocessableEntityException('Order request must be accepted first.')
    }

    const newStatus = orderRequest.status === 'buyer_filled' ? 'awaiting_payment' : 'seller_filled'

    const updated = await this.prisma.orderRequest.update({
      where: { id: requestId },
      data:  { price: dto.price, quantity: dto.quantity ?? orderRequest.quantity, status: newStatus },
    })

    this.gateway.emit(orderRequest.conversationId, 'order_request_updated', updated)

    if (newStatus === 'awaiting_payment') {
      const buyerId = conv.buyerUserId
      await this.notifications.notify(buyerId, 'payment_required', 'Vui lòng thanh toán để hoàn tất đơn hàng.', 'conversation', conv.id)
    }

    return updated
  }

  async fillBuyerInfo(userId: string, requestId: string, dto: BuyerInfoDto) {
    const orderRequest = await this.prisma.orderRequest.findUnique({ where: { id: requestId } })
    if (!orderRequest) throw new NotFoundException('Order request not found.')

    const conv = await this.getActiveConv(userId, orderRequest.conversationId)

    if (conv.buyerUserId !== userId) {
      throw new ForbiddenException('Only the buyer can fill buyer info.')
    }
    if (!['accepted', 'seller_filled'].includes(orderRequest.status)) {
      throw new UnprocessableEntityException('Order request must be accepted first.')
    }

    const newStatus = orderRequest.status === 'seller_filled' ? 'awaiting_payment' : 'buyer_filled'

    const updated = await this.prisma.orderRequest.update({
      where: { id: requestId },
      data: {
        buyerPhone:       dto.phone,
        buyerEmail:       dto.email,
        deliveryAddress:  dto.deliveryAddress,
        fulfillmentMethod: dto.fulfillmentMethod,
        status:           newStatus,
      },
    })

    this.gateway.emit(orderRequest.conversationId, 'order_request_updated', updated)

    if (newStatus === 'awaiting_payment') {
      await this.notifications.notify(conv.buyerUserId, 'payment_required', 'Vui lòng thanh toán để hoàn tất đơn hàng.', 'conversation', conv.id)
    }

    return updated
  }

  async finalizeOrder(orderRequest: any, conv: any) {
    const quantity = orderRequest.quantity ?? 1
    const price    = Number(orderRequest.price)
    const total    = price * quantity

    const meetupDetails = JSON.stringify({
      phone:           orderRequest.buyerPhone,
      email:           orderRequest.buyerEmail,
      deliveryAddress: orderRequest.deliveryAddress,
    })

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const order = await this.prisma.$transaction(async tx => {
      const offer = await tx.offer.create({
        data: {
          conversationId:    conv.id,
          createdByUserId:   conv.sellerUserId,
          matchId:           conv.matchId,
          quantity,
          proposedPrice:     price,
          totalPrice:        total,
          fulfillmentMethod: (orderRequest.fulfillmentMethod ?? 'delivery') as any,
          status:            'accepted',
          expiresAt,
        },
      })

      const newOrder = await tx.order.create({
        data: {
          offerId:           offer.id,
          matchId:           conv.matchId,
          buyerUserId:       conv.buyerUserId,
          sellerUserId:      conv.sellerUserId,
          quantity,
          finalPrice:        total,
          fulfillmentMethod: orderRequest.fulfillmentMethod ?? 'delivery',
          meetupDetails,
          status:            'created',
        },
      })

      // Link order back to request
      await tx.orderRequest.update({
        where: { id: orderRequest.id },
        data:  { orderId: newOrder.id },
      })

      // Close conversation
      await tx.conversation.update({
        where: { id: conv.id },
        data:  { status: 'closed', stage: 'closed', closeReason: 'completed' },
      })

      // System message
      await tx.message.create({
        data: {
          conversationId:    conv.id,
          senderUserId:      conv.sellerUserId,
          messageType:       'system',
          body:              `Order created for ${total.toLocaleString()} ₫. Conversation closed.`,
          isSystemGenerated: true,
        },
      })

      return newOrder
    })

    this.gateway.emit(conv.id, 'order_created', { orderId: order.id })

    await this.notifications.notify(conv.buyerUserId,  'order_created', `Order created for ${total.toLocaleString()} ₫.`, 'order', order.id)
    await this.notifications.notify(conv.sellerUserId, 'order_created', `Order created for ${total.toLocaleString()} ₫.`, 'order', order.id)

    // Log 'ordered' interaction for both participants (fire-and-forget)
    if (conv.matchId) {
      for (const uid of [conv.buyerUserId, conv.sellerUserId]) {
        this.prisma.matchInteraction.create({
          data: { matchId: conv.matchId, userId: uid, action: 'ordered', surface: 'direct' },
        }).catch(() => null)
      }
    }
  }

  // ─── ABANDON ──────────────────────────────────────────────────────────────

  async abandon(userId: string, conversationId: string) {
    const conv = await this.getActiveConv(userId, conversationId)

    // Check no completed/active order exists for this match
    const activeOrder = await this.prisma.order.findFirst({
      where: {
        matchId: conv.matchId,
        status:  { notIn: ['cancelled'] },
      },
    })
    if (activeOrder) {
      throw new UnprocessableEntityException('Cannot abandon a conversation with an active or completed order.')
    }

    const match = conv.matchId
      ? await this.prisma.match.findUnique({ where: { id: conv.matchId }, include: { snapshot: true } })
      : null

    await this.prisma.$transaction(async (tx) => {
      // Close the conversation
      await tx.conversation.update({
        where: { id: conversationId },
        data:  { status: 'closed', stage: 'closed', closeReason: 'abandoned' },
      })

      // System message
      await tx.message.create({
        data: {
          conversationId,
          senderUserId:      userId,
          messageType:       'system',
          body:              'The conversation was ended. Match has been marked as failed.',
          isSystemGenerated: true,
        },
      })

      if (match) {
        // Mark match as failed
        await tx.match.update({
          where: { id: match.id },
          data:  { status: 'closed_failed' },
        })

        // Log dismissed interaction for LTR training
        await tx.matchInteraction.create({
          data: {
            matchId:   match.id,
            snapshotId: match.snapshot?.id ?? null,
            userId,
            action:    'dismissed',
            surface:   'conversation',
            metadata:  { trigger: 'conversation_abandoned' },
          },
        })
      }
    })

    const otherId = conv.buyerUserId === userId ? conv.sellerUserId : conv.buyerUserId
    await this.notifications.notify(otherId, 'conversation_abandoned', 'The other party ended the conversation.', 'conversation', conversationId)

    this.gateway.emit(conversationId, 'conversation_abandoned', { conversationId })

    return { conversationId, status: 'closed', closeReason: 'abandoned' }
  }

  // ─── EVIDENCE REQUESTS ────────────────────────────────────────────────────

  async createEvidenceRequest(userId: string, conversationId: string, dto: CreateEvidenceRequestDto) {
    const conv = await this.getActiveConv(userId, conversationId)

    if (conv.buyerUserId !== userId) {
      throw new ForbiddenException('Only the buyer can request evidence.')
    }

    const existing = await this.prisma.evidenceRequest.count({ where: { conversationId } })
    if (existing >= 5) {
      throw new UnprocessableEntityException('Maximum 5 evidence requests per conversation.')
    }

    const er = await this.prisma.evidenceRequest.create({
      data: {
        conversationId,
        requesterUserId: userId,
        requestType:     dto.requestType,
        description:     dto.description,
        dueAt:           new Date(dto.dueAt),
      },
    })

    await this.notifications.notify(conv.sellerUserId, 'evidence_requested', `Buyer has requested: ${dto.description.slice(0, 80)}`, 'conversation', conversationId)

    return er
  }

  async fulfillEvidenceRequest(userId: string, conversationId: string, erId: string, dto: FulfillEvidenceRequestDto) {
    const conv = await this.getActiveConv(userId, conversationId)

    if (conv.sellerUserId !== userId) {
      throw new ForbiddenException('Only the seller can fulfill evidence requests.')
    }

    const er = await this.prisma.evidenceRequest.findUnique({ where: { id: erId } })
    if (!er || er.conversationId !== conversationId) throw new NotFoundException('Evidence request not found.')
    if (er.status !== 'pending') {
      throw new UnprocessableEntityException(`Evidence request already ${er.status}.`)
    }

    const updated = await this.prisma.evidenceRequest.update({
      where: { id: erId },
      data: {
        status:          dto.action,
        fulfilledAt:     dto.action === 'fulfilled' ? new Date() : undefined,
        rejectionReason: dto.action === 'rejected' ? dto.rejectionReason : undefined,
      },
    })

    await this.notifications.notify(conv.buyerUserId, `evidence_${dto.action}`, `Seller has ${dto.action} the evidence request.`, 'conversation', conversationId)

    return updated
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────

  private async getActiveConv(userId: string, id: string) {
    const conv = await this.prisma.conversation.findUnique({ where: { id } })
    if (!conv) throw new NotFoundException('Conversation not found.')
    this.assertParticipant(userId, conv)
    if (conv.status !== 'active') {
      throw new UnprocessableEntityException('Conversation is closed.')
    }
    return conv
  }

  private assertParticipant(userId: string, conv: { buyerUserId: string; sellerUserId: string }) {
    if (conv.buyerUserId !== userId && conv.sellerUserId !== userId) {
      throw new ForbiddenException('Access denied.')
    }
  }
}
