import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { PrismaService }        from '../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { transitionMatch }      from '../common/state-machines'

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma:         PrismaService,
    private readonly notifications:  NotificationsService,
  ) {}

  async getSnapshot(userId: string, matchId: string) {
    const match = await this.prisma.match.findUnique({
      where:   { id: matchId },
      include: {
        demandRequest:  { include: { buyerProfile: true } },
        productListing: { include: { sellerProfile: true } },
        snapshot:       true,
      },
    })
    if (!match) throw new NotFoundException('Match not found.')
    await this.assertParticipant(userId, match)
    if (!match.snapshot) throw new NotFoundException('No snapshot for this match yet.')
    return match.snapshot
  }

  async getInteractions(userId: string, matchId: string) {
    const match = await this.prisma.match.findUnique({
      where:   { id: matchId },
      include: {
        demandRequest:  { include: { buyerProfile: true } },
        productListing: { include: { sellerProfile: true } },
      },
    })
    if (!match) throw new NotFoundException('Match not found.')
    await this.assertParticipant(userId, match)

    const interactions = await this.prisma.matchInteraction.findMany({
      where:   { matchId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, name: true, email: true } } },
    })

    const ACTION_SCORE: Record<string, number> = {
      ordered: 1.0, offered: 0.9, messaged: 0.7,
      accepted: 0.5, dismissed: 0.0,
      detail_viewed: 0.3, impressed: 0.2,
    }
    const label = interactions.length === 0
      ? null
      : interactions.reduce((best, i) => {
          const v = ACTION_SCORE[i.action] ?? 0.2
          return v > best ? v : best
        }, 0.2)

    return { matchId, label, interactionCount: interactions.length, interactions }
  }

  async logInteraction(
    userId:     string,
    matchId:    string,
    action:     string,
    surface?:   string,
    sessionId?: string,
    metadata?:  any,
  ) {
    const match = await this.prisma.match.findUnique({
      where:   { id: matchId },
      include: {
        demandRequest:  { include: { buyerProfile: true } },
        productListing: { include: { sellerProfile: true } },
        snapshot:       true,
      },
    })
    if (!match) throw new NotFoundException('Match not found.')
    await this.assertParticipant(userId, match)

    const validActions = ['impressed', 'detail_viewed', 'accepted', 'dismissed', 'messaged', 'offered', 'ordered']
    if (!validActions.includes(action)) {
      throw new UnprocessableEntityException(`Invalid action '${action}'. Must be one of: ${validActions.join(', ')}`)
    }

    return this.prisma.matchInteraction.create({
      data: {
        matchId,
        snapshotId: match.snapshot?.id ?? null,
        userId,
        action,
        surface:    surface   ?? null,
        sessionId:  sessionId ?? null,
        metadata:   metadata  ?? null,
      },
    })
  }

  async findOne(userId: string, matchId: string) {
    const match = await this.prisma.match.findUnique({
      where:   { id: matchId },
      include: {
        demandRequest:  { include: { buyerProfile: true, category: true } },
        productListing: { include: { sellerProfile: true, category: true, proofAssets: true } },
        conversation:   true,
      },
    })
    if (!match) throw new NotFoundException('Match not found.')
    await this.assertParticipant(userId, match)
    return match
  }

  async acknowledge(userId: string, matchId: string) {
    const fullMatch = await this.prisma.match.findUnique({
      where:   { id: matchId },
      include: {
        demandRequest:  { include: { buyerProfile: true } },
        productListing: { include: { sellerProfile: true } },
      },
    })
    if (!fullMatch) throw new NotFoundException('Match not found.')
    await this.assertParticipant(userId, fullMatch)
    const match = fullMatch  // alias for clarity

    const isBuyer  = match.demandRequest.buyerProfile.userId  === userId
    const isSeller = match.productListing.sellerProfile.userId === userId

    const data: any = {}
    if (isBuyer)  data.buyerAcknowledged  = true
    if (isSeller) data.sellerAcknowledged = true

    // Determine next status
    const newBuyer  = isBuyer  ? true : match.buyerAcknowledged
    const newSeller = isSeller ? true : match.sellerAcknowledged

    if (newBuyer && newSeller) {
      // both sides → will open conversation below, status set to active there
    } else if (newBuyer) {
      data.status = 'buyer_confirmed'
    } else if (newSeller) {
      data.status = 'seller_confirmed'
    }

    const updated = await this.prisma.match.update({ where: { id: matchId }, data })

    // Both sides acknowledged → open conversation if none yet
    const existingConv = await this.prisma.conversation.findUnique({ where: { matchId } })
    if (newBuyer && newSeller && !existingConv) {
      await this.openConversation(updated, fullMatch)
    }

    // Notify the other party they can now accept
    if (!newBuyer || !newSeller) {
      const otherId = isBuyer
        ? fullMatch.productListing.sellerProfile.userId
        : fullMatch.demandRequest.buyerProfile.userId
      await this.notifications.notify(
        otherId,
        'match_found',
        `The other party accepted a match. Your turn to accept or decline.`,
        'match',
        matchId,
      )
    }

    return updated
  }

  async decline(userId: string, matchId: string) {
    const match = await this.prisma.match.findUnique({
      where:   { id: matchId },
      include: {
        demandRequest:  { include: { buyerProfile: true } },
        productListing: { include: { sellerProfile: true } },
        snapshot:       true,
      },
    })
    if (!match) throw new NotFoundException('Match not found.')
    await this.assertParticipant(userId, match)

    if (!['proposed', 'buyer_confirmed', 'seller_confirmed'].includes(match.status)) {
      throw new UnprocessableEntityException(`Cannot decline match with status '${match.status}'.`)
    }

    const nextStatus = transitionMatch(match.status, 'closed_failed')

    const [updated] = await this.prisma.$transaction([
      this.prisma.match.update({ where: { id: matchId }, data: { status: nextStatus } }),
      this.prisma.matchInteraction.create({
        data: {
          matchId,
          snapshotId: match.snapshot?.id ?? null,
          userId,
          action:     'dismissed',
          surface:    'match_detail',
          metadata:   { trigger: 'explicit_decline' },
        },
      }),
    ])

    // Notify the other party
    const otherId = match.demandRequest.buyerProfile.userId === userId
      ? match.productListing.sellerProfile.userId
      : match.demandRequest.buyerProfile.userId
    await this.notifications.notify(otherId, 'match_declined', 'The other party declined the match.', 'match', matchId)

    return updated
  }

  // ─── PRIVATE HELPERS ───────────────────────────────────────────────────────

  private async assertParticipant(userId: string, match: any) {
    const buyerId  = match.demandRequest?.buyerProfile?.userId  ?? match.demandRequest?.buyerProfileId
    const sellerId = match.productListing?.sellerProfile?.userId ?? match.productListing?.sellerProfileId

    // Load profiles if not already included
    if (!buyerId || !sellerId) {
      const demand  = await this.prisma.demandRequest.findUnique({
        where: { id: match.demandRequestId }, include: { buyerProfile: true },
      })
      const listing = await this.prisma.productListing.findUnique({
        where: { id: match.productListingId }, include: { sellerProfile: true },
      })
      if (demand?.buyerProfile.userId !== userId && listing?.sellerProfile.userId !== userId) {
        throw new ForbiddenException('Access denied.')
      }
      return
    }

    if (buyerId !== userId && sellerId !== userId) {
      throw new ForbiddenException('Access denied.')
    }
  }

  private async openConversation(match: any, fullMatch: any) {
    const autoCloseAt = new Date()
    autoCloseAt.setDate(autoCloseAt.getDate() + 14)
    const buyerUserId  = fullMatch.demandRequest.buyerProfile.userId
    const sellerUserId = fullMatch.productListing.sellerProfile.userId

    // Single nested create: conversation + system message in one DB transaction.
    // No window exists between conversation creation and message insertion,
    // so no user message can ever precede the system message.
    const conversation = await this.prisma.conversation.create({
      data: {
        matchId:     match.id,
        buyerUserId,
        sellerUserId,
        autoCloseAt,
        messages: {
          create: {
            senderUserId:      buyerUserId,
            messageType:       'system',
            body:              'Conversation opened. Start with the Verification stage.',
            isSystemGenerated: true,
          },
        },
      },
    })

    await this.prisma.match.update({
      where: { id: match.id },
      data:  { status: 'active' },
    })

    await this.notifications.notify(
      fullMatch.demandRequest.buyerProfile.userId,
      'conversation_opened',
      'Your match has been accepted. A conversation has been opened.',
      'conversation',
      conversation.id,
    )
    await this.notifications.notify(
      fullMatch.productListing.sellerProfile.userId,
      'conversation_opened',
      'A buyer has accepted your match. A conversation has been opened.',
      'conversation',
      conversation.id,
    )
  }
}
