import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
  forwardRef,
  Inject,
} from '@nestjs/common'
import { PrismaService }        from '../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { OrdersGateway }        from './orders.gateway'
import { CancelOrderDto, DisputeOrderDto, ReviewOrderDto } from './dto/orders.dto'

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma:        PrismaService,
    private readonly notifications: NotificationsService,
    @Inject(forwardRef(() => OrdersGateway))
    private readonly gateway:       OrdersGateway,
  ) {}

  // ─── LIST ─────────────────────────────────────────────────────────────────

  async list(userId: string) {
    return this.prisma.order.findMany({
      where: { OR: [{ buyerUserId: userId }, { sellerUserId: userId }] },
      include: {
        match: {
          include: {
            demandRequest:  { select: { title: true } },
            productListing: { select: { title: true } },
          },
        },
        offer: { select: { fulfillmentMethod: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  // ─── GET ONE ──────────────────────────────────────────────────────────────

  async findOne(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where:   { id: orderId },
      include: {
        match: {
          include: {
            demandRequest:  { include: { category: true } },
            productListing: { include: { proofAssets: true } },
          },
        },
        offer:        true,
        ratingReviews: true,
        dispute:       true,
      },
    })
    if (!order) throw new NotFoundException('Order not found.')
    this.assertParticipant(userId, order)
    return order
  }

  // ─── CONFIRM ──────────────────────────────────────────────────────────────

  async confirm(userId: string, orderId: string) {
    const order = await this.getOrder(userId, orderId)

    if (!['created', 'in_progress'].includes(order.status)) {
      throw new UnprocessableEntityException(`Cannot confirm order with status '${order.status}'.`)
    }

    const isBuyer  = order.buyerUserId  === userId
    const isSeller = order.sellerUserId === userId

    const data: any = {}
    if (isBuyer)  data.buyerConfirmedComplete  = true
    if (isSeller) data.sellerConfirmedComplete = true

    // If both confirmed → complete
    const newBuyer  = isBuyer  ? true : order.buyerConfirmedComplete
    const newSeller = isSeller ? true : order.sellerConfirmedComplete

    if (newBuyer && newSeller) {
      data.status      = 'completed'
      data.completedAt = new Date()
    } else {
      data.status = 'in_progress'
    }

    const updated = await this.prisma.order.update({ where: { id: orderId }, data })

    // Push realtime update to both parties
    this.gateway.emit(orderId, 'order_updated', updated)

    if (data.status === 'completed') {
      await this.onOrderCompleted(updated)
    } else {
      const otherId = isBuyer ? order.sellerUserId : order.buyerUserId
      await this.notifications.notify(otherId, 'order_confirmed_partial', 'The other party has confirmed completion.', 'order', orderId)
    }

    return updated
  }

  // ─── CANCEL ───────────────────────────────────────────────────────────────

  async cancel(userId: string, orderId: string, dto: CancelOrderDto) {
    const order = await this.getOrder(userId, orderId)

    if (!['created', 'in_progress'].includes(order.status)) {
      throw new UnprocessableEntityException(`Cannot cancel order with status '${order.status}'.`)
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data:  { status: 'cancelled', cancelledAt: new Date(), cancellationReason: dto.reason },
    })

    this.gateway.emit(orderId, 'order_updated', updated)

    const otherId = order.buyerUserId === userId ? order.sellerUserId : order.buyerUserId
    await this.notifications.notify(otherId, 'order_cancelled', `Order was cancelled: ${dto.reason.slice(0, 80)}`, 'order', orderId)

    return updated
  }

  // ─── DISPUTE ──────────────────────────────────────────────────────────────

  async dispute(userId: string, orderId: string, dto: DisputeOrderDto) {
    const order = await this.getOrder(userId, orderId)

    if (order.status !== 'completed') {
      throw new UnprocessableEntityException('Can only dispute completed orders.')
    }
    if (!order.completedAt) throw new UnprocessableEntityException('Order not yet completed.')

    const elapsed = Date.now() - order.completedAt.getTime()
    if (elapsed > 48 * 3_600_000) {
      throw new UnprocessableEntityException('Dispute window has expired (48 hours after completion).')
    }

    const existing = await this.prisma.dispute.findUnique({ where: { orderId } })
    if (existing) throw new UnprocessableEntityException('A dispute already exists for this order.')

    const disputeRecord = await this.prisma.dispute.create({
      data: {
        orderId,
        filedByUserId: userId,
        disputeType:   dto.disputeType,
        description:   dto.description,
        status:        'opened',
      },
    })

    await this.prisma.order.update({ where: { id: orderId }, data: { status: 'disputed' } })

    const otherId = order.buyerUserId === userId ? order.sellerUserId : order.buyerUserId
    await this.notifications.notify(otherId, 'dispute_filed', 'A dispute has been filed for your order.', 'order', orderId)

    return disputeRecord
  }

  // ─── REVIEW ───────────────────────────────────────────────────────────────

  async review(userId: string, orderId: string, dto: ReviewOrderDto) {
    const order = await this.getOrder(userId, orderId)

    if (order.status !== 'completed') {
      throw new UnprocessableEntityException('Can only review completed orders.')
    }
    if (!order.completedAt) throw new UnprocessableEntityException('Order not yet completed.')

    const elapsed = Date.now() - order.completedAt.getTime()
    if (elapsed > 7 * 24 * 3_600_000) {
      throw new UnprocessableEntityException('Review window has expired (7 days after completion).')
    }

    const isBuyer      = order.buyerUserId  === userId
    const roleOfReviewer: 'buyer' | 'seller' = isBuyer ? 'buyer' : 'seller'
    const reviewedUserId = isBuyer ? order.sellerUserId : order.buyerUserId

    const existing = await this.prisma.ratingReview.findUnique({
      where: { orderId_roleOfReviewer: { orderId, roleOfReviewer } },
    })
    if (existing) throw new UnprocessableEntityException('You have already reviewed this order.')

    const review = await this.prisma.ratingReview.create({
      data: {
        orderId,
        reviewerUserId: userId,
        reviewedUserId,
        roleOfReviewer,
        rating:  dto.rating,
        comment: dto.comment,
      },
    })

    await this.notifications.notify(reviewedUserId, 'review_received', `You received a ${dto.rating}★ review.`, 'order', orderId)

    // Update aggregate rating on profile
    await this.updateProfileRating(reviewedUserId, isBuyer ? 'seller' : 'buyer')

    return review
  }

  // ─── PRIVATE ──────────────────────────────────────────────────────────────

  private async onOrderCompleted(order: any) {
    await this.notifications.notify(order.buyerUserId,  'order_completed', 'Order completed. Please leave a review!', 'order', order.id)
    await this.notifications.notify(order.sellerUserId, 'order_completed', 'Order completed. Please leave a review!', 'order', order.id)
  }

  private async updateProfileRating(userId: string, role: 'buyer' | 'seller') {
    const reviews = await this.prisma.ratingReview.findMany({
      where: { reviewedUserId: userId },
      select: { rating: true },
    })
    if (reviews.length === 0) return

    const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length

    if (role === 'seller') {
      await this.prisma.sellerProfile.update({ where: { userId }, data: { sellerRating: avg } })
    } else {
      await this.prisma.buyerProfile.update({ where: { userId }, data: { buyerRating: avg } })
    }
  }

  private async getOrder(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order) throw new NotFoundException('Order not found.')
    this.assertParticipant(userId, order)
    return order
  }

  private assertParticipant(userId: string, order: { buyerUserId: string; sellerUserId: string }) {
    if (order.buyerUserId !== userId && order.sellerUserId !== userId) {
      throw new ForbiddenException('Access denied.')
    }
  }
}
