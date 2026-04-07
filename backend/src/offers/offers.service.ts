import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { PrismaService }        from '../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { transitionOffer, transitionOrder } from '../common/state-machines'
import { CreateOfferDto, CounterOfferDto }  from './dto/offers.dto'

@Injectable()
export class OffersService {
  constructor(
    private readonly prisma:        PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ─── CREATE OFFER ─────────────────────────────────────────────────────────

  async create(userId: string, matchId: string, dto: CreateOfferDto) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: dto.conversationId },
    })
    if (!conv) throw new NotFoundException('Conversation not found.')
    this.assertParticipant(userId, conv)
    if (conv.status !== 'active') throw new UnprocessableEntityException('Conversation is closed.')
    if (conv.stage !== 'negotiation') {
      throw new UnprocessableEntityException('Offers can only be created in the negotiation stage.')
    }

    // Only one pending offer at a time
    const pending = await this.prisma.offer.findFirst({
      where: { conversationId: conv.id, status: 'pending' },
    })
    if (pending) throw new UnprocessableEntityException('There is already an active pending offer.')

    const expiresAt = new Date(Date.now() + 48 * 3_600_000)
    const totalPrice = dto.proposedPrice * dto.quantity

    const offer = await this.prisma.offer.create({
      data: {
        conversationId:   conv.id,
        createdByUserId:  userId,
        matchId,
        quantity:         dto.quantity,
        proposedPrice:    dto.proposedPrice,
        totalPrice,
        fulfillmentMethod: dto.fulfillmentMethod,
        meetupLocation:   dto.meetupLocation,
        meetupTime:       dto.meetupTime ? new Date(dto.meetupTime) : undefined,
        termsNotes:       dto.termsNotes,
        status:           'pending',
        expiresAt,
      },
    })

    const otherId = conv.buyerUserId === userId ? conv.sellerUserId : conv.buyerUserId
    await this.notifications.notify(otherId, 'offer_received', `New offer: ${dto.proposedPrice} × ${dto.quantity}`, 'offer', offer.id)

    return offer
  }

  // ─── GET OFFER ────────────────────────────────────────────────────────────

  async findOne(userId: string, offerId: string) {
    const offer = await this.prisma.offer.findUnique({
      where:   { id: offerId },
      include: { conversation: true },
    })
    if (!offer) throw new NotFoundException('Offer not found.')
    this.assertParticipant(userId, offer.conversation)
    return offer
  }

  // ─── ACCEPT ───────────────────────────────────────────────────────────────

  async accept(userId: string, offerId: string) {
    const offer = await this.getOffer(userId, offerId)
    if (offer.createdByUserId === userId) {
      throw new ForbiddenException('Cannot accept your own offer.')
    }

    const nextStatus = transitionOffer(offer.status, 'accepted')
    const accepted = await this.prisma.offer.update({ where: { id: offerId }, data: { status: nextStatus } })

    const conv = offer.conversation
    // Create Order atomically
    const order = await this.prisma.order.create({
      data: {
        offerId,
        matchId:          offer.matchId,
        buyerUserId:      conv.buyerUserId,
        sellerUserId:     conv.sellerUserId,
        quantity:         offer.quantity,
        finalPrice:       offer.totalPrice,
        fulfillmentMethod: String(offer.fulfillmentMethod),
        meetupDetails:    offer.meetupLocation ?? undefined,
        proofSnapshot:    offer.proofSnapshot ?? undefined,
      },
    })

    // Close conversation
    await this.prisma.conversation.update({
      where: { id: conv.id },
      data:  { status: 'closed', closeReason: 'completed' },
    })

    await this.notifications.notify(offer.createdByUserId, 'offer_accepted', 'Your offer was accepted. Order created!', 'order', order.id)
    const otherId = offer.createdByUserId === conv.buyerUserId ? conv.sellerUserId : conv.buyerUserId
    await this.notifications.notify(otherId, 'order_created', 'Order created from accepted offer.', 'order', order.id)

    return { offer: accepted, order }
  }

  // ─── REJECT ───────────────────────────────────────────────────────────────

  async reject(userId: string, offerId: string) {
    const offer = await this.getOffer(userId, offerId)
    if (offer.createdByUserId === userId) {
      throw new ForbiddenException('Cannot reject your own offer.')
    }

    const nextStatus = transitionOffer(offer.status, 'rejected')
    const updated = await this.prisma.offer.update({ where: { id: offerId }, data: { status: nextStatus } })

    await this.notifications.notify(offer.createdByUserId, 'offer_rejected', 'Your offer was rejected.', 'offer', offerId)
    return updated
  }

  // ─── COUNTER ──────────────────────────────────────────────────────────────

  async counter(userId: string, offerId: string, dto: CounterOfferDto) {
    const offer = await this.getOffer(userId, offerId)
    if (offer.createdByUserId === userId) {
      throw new ForbiddenException('Cannot counter your own offer.')
    }

    const nextStatus = transitionOffer(offer.status, 'countered')
    await this.prisma.offer.update({ where: { id: offerId }, data: { status: nextStatus } })

    const expiresAt  = new Date(Date.now() + 48 * 3_600_000)
    const totalPrice = dto.proposedPrice * dto.quantity

    const counterOffer = await this.prisma.offer.create({
      data: {
        conversationId:   offer.conversationId,
        createdByUserId:  userId,
        matchId:          offer.matchId,
        quantity:         dto.quantity,
        proposedPrice:    dto.proposedPrice,
        totalPrice,
        fulfillmentMethod: dto.fulfillmentMethod,
        meetupLocation:   dto.meetupLocation,
        meetupTime:       dto.meetupTime ? new Date(dto.meetupTime) : undefined,
        termsNotes:       dto.termsNotes,
        parentOfferId:    offerId,
        status:           'pending',
        expiresAt,
      },
    })

    await this.prisma.offer.update({ where: { id: offerId }, data: { counterOfferId: counterOffer.id } })

    await this.notifications.notify(offer.createdByUserId, 'offer_countered', `Counter-offer: ${dto.proposedPrice} × ${dto.quantity}`, 'offer', counterOffer.id)
    return counterOffer
  }

  // ─── CANCEL ───────────────────────────────────────────────────────────────

  async cancel(userId: string, offerId: string) {
    const offer = await this.getOffer(userId, offerId)
    if (offer.createdByUserId !== userId) {
      throw new ForbiddenException('Only the offer creator can cancel it.')
    }

    const nextStatus = transitionOffer(offer.status, 'cancelled')
    return this.prisma.offer.update({ where: { id: offerId }, data: { status: nextStatus } })
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────

  private async getOffer(userId: string, offerId: string) {
    const offer = await this.prisma.offer.findUnique({
      where:   { id: offerId },
      include: { conversation: true },
    })
    if (!offer) throw new NotFoundException('Offer not found.')
    this.assertParticipant(userId, offer.conversation)
    if (offer.status !== 'pending') {
      throw new UnprocessableEntityException(`Offer is already ${offer.status}.`)
    }
    return offer
  }

  private assertParticipant(userId: string, conv: { buyerUserId: string; sellerUserId: string }) {
    if (conv.buyerUserId !== userId && conv.sellerUserId !== userId) {
      throw new ForbiddenException('Access denied.')
    }
  }
}
