import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { ItemCondition } from '@prisma/client'

const CONDITION_RANK: Record<ItemCondition, number> = {
  poor: 0,
  fair: 1,
  good: 2,
  very_good: 3,
  like_new: 4,
}

interface ScoreBreakdown {
  category: number
  budget: number
  condition: number
  location: number
  quantity: number
  aiSemantic: number
  total: number
}

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  // ─── PUBLIC TRIGGER METHODS ────────────────────────────────────────────────

  async runForDemand(demandId: string): Promise<void> {
    const demand = await this.prisma.demandRequest.findUnique({
      where: { id: demandId },
      include: { buyerProfile: true },
    })
    if (!demand || !['active', 'waiting'].includes(demand.status)) return

    const listings = await this.prisma.productListing.findMany({
      where: {
        status: 'active',
        categoryId: demand.categoryId,
      },
      include: { sellerProfile: true },
    })

    const aiScores = await this.fetchAIScores(demand.title + ' ' + (demand.description ?? ''), listings.map(l => l.id))

    for (const listing of listings) {
      const existing = await this.prisma.match.findUnique({
        where: { demandRequestId_productListingId: { demandRequestId: demandId, productListingId: listing.id } },
      })
      if (existing) continue

      const breakdown = this.computeScore(demand as any, listing as any, aiScores[listing.id] ?? 0)
      if (breakdown.total < 30) continue

      const match = await this.prisma.match.create({
        data: {
          demandRequestId:  demandId,
          productListingId: listing.id,
          matchScore:       breakdown.total,
          matchConfidence:  this.toConfidence(breakdown.total),
          scoreBreakdown:   breakdown as any,
          missingInfoFlags: this.buildMissingFlags(demand as any, listing as any),
          status:           'proposed',
        },
      })

      // Notify buyer
      await this.notifications.notify(
        demand.buyerProfile.userId,
        'match_found',
        `New match found for your demand "${demand.title}".`,
        'match',
        match.id,
      )
      // Notify seller
      await this.notifications.notify(
        listing.sellerProfile.userId,
        'match_found',
        `Your listing "${listing.title}" has been matched with a buyer.`,
        'match',
        match.id,
      )
    }
  }

  async runForListing(listingId: string): Promise<void> {
    const listing = await this.prisma.productListing.findUnique({
      where: { id: listingId },
      include: { sellerProfile: true },
    })
    if (!listing || listing.status !== 'active') return

    const demands = await this.prisma.demandRequest.findMany({
      where: {
        status: { in: ['active', 'waiting'] },
        categoryId: listing.categoryId,
      },
      include: { buyerProfile: true },
    })

    const aiScores = await this.fetchAIScores(listing.title + ' ' + (listing.description ?? ''), demands.map(d => d.id))

    for (const demand of demands) {
      const existing = await this.prisma.match.findUnique({
        where: { demandRequestId_productListingId: { demandRequestId: demand.id, productListingId: listingId } },
      })
      if (existing) continue

      const breakdown = this.computeScore(demand as any, listing as any, aiScores[demand.id] ?? 0)
      if (breakdown.total < 30) continue

      const match = await this.prisma.match.create({
        data: {
          demandRequestId:  demand.id,
          productListingId: listingId,
          matchScore:       breakdown.total,
          matchConfidence:  this.toConfidence(breakdown.total),
          scoreBreakdown:   breakdown as any,
          missingInfoFlags: this.buildMissingFlags(demand as any, listing as any),
          status:           'proposed',
        },
      })

      await this.notifications.notify(
        demand.buyerProfile.userId,
        'match_found',
        `New match found for your demand "${demand.title}".`,
        'match',
        match.id,
      )
      await this.notifications.notify(
        listing.sellerProfile.userId,
        'match_found',
        `Your listing "${listing.title}" has been matched with a buyer.`,
        'match',
        match.id,
      )
    }
  }

  // ─── RULE-BASED SCORING ────────────────────────────────────────────────────

  private computeScore(demand: any, listing: any, aiScore: number): ScoreBreakdown {
    const category  = this.scoreCategory(demand, listing)
    const budget    = this.scoreBudget(demand, listing)
    const condition = this.scoreCondition(demand, listing)
    const location  = this.scoreLocation(demand, listing)
    const quantity  = this.scoreQuantity(demand, listing)

    // Weights: category 25, budget 30, condition 20, location 10, quantity 5, ai 10
    const total = Math.round(
      category * 0.25 +
      budget   * 0.30 +
      condition * 0.20 +
      location * 0.10 +
      quantity * 0.05 +
      aiScore  * 0.10,
    )

    return { category, budget, condition, location, quantity, aiSemantic: aiScore, total }
  }

  private scoreCategory(demand: any, listing: any): number {
    if (demand.categoryId !== listing.categoryId) return 0
    if (demand.subcategoryId && listing.subcategoryId) {
      return demand.subcategoryId === listing.subcategoryId ? 100 : 60
    }
    return 80
  }

  private scoreBudget(demand: any, listing: any): number {
    const price    = Number(listing.priceExpectation)
    const budMin   = Number(demand.budgetMin)
    const budMax   = Number(demand.budgetMax)

    if (price >= budMin && price <= budMax) return 100
    if (price < budMin) {
      // Listing is cheaper — great for buyer
      const gap = budMin - price
      return Math.max(0, 100 - Math.round((gap / budMin) * 100))
    }
    // Listing is more expensive
    if (listing.priceFlexible) {
      const gap = price - budMax
      return Math.max(0, 80 - Math.round((gap / budMax) * 100))
    }
    const gap = price - budMax
    return Math.max(0, 60 - Math.round((gap / budMax) * 150))
  }

  private scoreCondition(demand: any, listing: any): number {
    const demandRank  = CONDITION_RANK[demand.preferredCondition as ItemCondition] ?? 2
    const listingRank = CONDITION_RANK[listing.condition as ItemCondition] ?? 2

    if (listingRank >= demandRank) return 100
    const diff = demandRank - listingRank
    return Math.max(0, 100 - diff * 25)
  }

  private scoreLocation(demand: any, listing: any): number {
    if (!demand.location || !listing.location) return 70  // unknown = neutral
    return demand.location.toLowerCase() === listing.location.toLowerCase() ? 100 : 40
  }

  private scoreQuantity(demand: any, listing: any): number {
    return listing.quantityRemaining >= demand.quantityNeeded ? 100 : 50
  }

  private toConfidence(total: number): 'high' | 'medium' | 'low' {
    if (total >= 75) return 'high'
    if (total >= 50) return 'medium'
    return 'low'
  }

  private buildMissingFlags(demand: any, listing: any): string[] {
    const flags: string[] = []
    if (!listing.description) flags.push('no_listing_description')
    if (!demand.description) flags.push('no_demand_description')
    if (listing.proofCompletenessScore < 60) flags.push('low_proof_score')
    if (!listing.location) flags.push('no_listing_location')
    if (!demand.location) flags.push('no_demand_location')
    return flags
  }

  // ─── AI SERVICE BRIDGE ─────────────────────────────────────────────────────

  private async fetchAIScores(query: string, ids: string[]): Promise<Record<string, number>> {
    const aiUrl = this.config.get<string>('AI_SERVICE_URL')
    if (!aiUrl || ids.length === 0) return {}

    try {
      const res = await fetch(`${aiUrl}/search`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ query, top_k: 50 }),
        signal:  AbortSignal.timeout(5000),
      })
      if (!res.ok) return {}

      const data: { results: Array<{ id: string; score: number }> } = await res.json()
      const map: Record<string, number> = {}
      for (const r of data.results) {
        if (ids.includes(r.id)) {
          map[r.id] = Math.round(r.score * 100)
        }
      }
      return map
    } catch (err) {
      this.logger.warn(`AI service unreachable: ${(err as Error).message}`)
      return {}
    }
  }
}
