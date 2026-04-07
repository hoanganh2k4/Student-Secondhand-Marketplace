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
      },
    })
    if (!match) throw new NotFoundException('Match not found.')
    await this.assertParticipant(userId, match)

    if (!['proposed', 'buyer_confirmed', 'seller_confirmed'].includes(match.status)) {
      throw new UnprocessableEntityException(`Cannot decline match with status '${match.status}'.`)
    }

    const nextStatus = transitionMatch(match.status, 'closed_failed')
    return this.prisma.match.update({ where: { id: matchId }, data: { status: nextStatus } })
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

    const conversation = await this.prisma.conversation.create({
      data: {
        matchId:      match.id,
        buyerUserId:  fullMatch.demandRequest.buyerProfile.userId,
        sellerUserId: fullMatch.productListing.sellerProfile.userId,
        autoCloseAt,
      },
    })

    await this.prisma.match.update({
      where: { id: match.id },
      data:  { status: 'active' },
    })

    // System message
    await this.prisma.message.create({
      data: {
        conversationId:    conversation.id,
        senderUserId:      fullMatch.demandRequest.buyerProfile.userId,
        messageType:       'system',
        body:              'Conversation opened. Start with the Verification stage.',
        isSystemGenerated: true,
      },
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
