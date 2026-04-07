import { Injectable, Logger }    from '@nestjs/common'
import { Cron }                  from '@nestjs/schedule'
import { PrismaService }         from '../prisma/prisma.service'
import { NotificationsService }  from '../notifications/notifications.service'

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name)

  constructor(
    private readonly prisma:        PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('0 * * * *')
  async expireDemands() {
    const result = await this.prisma.demandRequest.updateMany({
      where: {
        expiresAt: { lt: new Date() },
        status:    { notIn: ['expired', 'cancelled', 'fulfilled'] },
      },
      data: { status: 'expired' },
    })
    this.logger.log(`expireDemands: ${result.count} updated`)
  }

  @Cron('0 * * * *')
  async expireListings() {
    const result = await this.prisma.productListing.updateMany({
      where: {
        expiresAt: { lt: new Date() },
        status:    { notIn: ['expired', 'sold', 'removed'] },
      },
      data: { status: 'expired' },
    })
    this.logger.log(`expireListings: ${result.count} updated`)
  }

  @Cron('*/15 * * * *')
  async expireOffers() {
    const result = await this.prisma.offer.updateMany({
      where: { expiresAt: { lt: new Date() }, status: 'pending' },
      data:  { status: 'expired' },
    })
    this.logger.log(`expireOffers: ${result.count} updated`)
  }

  @Cron('0 */6 * * *')
  async closeInactiveConversations() {
    const now          = new Date()
    const twoDaysLater = new Date(now.getTime() + 2 * 24 * 3_600_000)

    const closed = await this.prisma.conversation.updateMany({
      where: { autoCloseAt: { lt: now }, status: 'active' },
      data:  { status: 'closed', closeReason: 'expired' },
    })

    const soonClosing = await this.prisma.conversation.findMany({
      where: {
        autoCloseAt: { gte: now, lte: twoDaysLater },
        status:      'active',
      },
      select: { id: true, buyerUserId: true, sellerUserId: true },
    })

    for (const conv of soonClosing) {
      for (const userId of [conv.buyerUserId, conv.sellerUserId]) {
        await this.notifications.notify(
          userId,
          'conversation_closing_soon',
          'Your conversation will auto-close in 2 days due to inactivity.',
          'conversation',
          conv.id,
        )
      }
    }

    this.logger.log(`closeInactiveConversations: closed ${closed.count}, warned ${soonClosing.length}`)
  }
}
