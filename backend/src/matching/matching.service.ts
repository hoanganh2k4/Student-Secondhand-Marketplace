import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { AiService } from '../ai/ai.service'

// Minimum cosine similarity (0–1) to create a Match record
const MATCH_THRESHOLD = 0.30

// Condition ordering for penalty calculation (lower index = worse condition)
const CONDITION_ORDER = ['poor', 'fair', 'good', 'very_good', 'like_new']

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name)

  constructor(
    private readonly prisma:        PrismaService,
    private readonly ai:            AiService,
    private readonly notifications: NotificationsService,
  ) {}

  // ─── PUBLIC TRIGGER METHODS ────────────────────────────────────────────────

  /**
   * Called when a demand is activated.
   * Scores the demand against all active listings in the same category via AI.
   */
  async runForDemand(demandId: string): Promise<void> {
    const demand = await this.prisma.demandRequest.findUnique({
      where: { id: demandId },
      include: {
        buyerProfile: true,
        category:     true,
      },
    })
    if (!demand || !['active', 'waiting'].includes(demand.status)) return

    const listings = await this.prisma.productListing.findMany({
      where: {
        status:        'active',
        categoryId:    demand.categoryId,
        sellerProfile: { userId: { not: demand.buyerProfile.userId } },
      },
      include: { sellerProfile: true, proofAssets: true, category: true },
    })
    if (listings.length === 0) return

    const queryText  = this.buildDemandText(demand as any)
    const candidates = listings.map(l => ({
      id:   l.id,
      text: this.buildListingText(l as any),
    }))

    const { scores, rawResults } = await this.scoreWithAI(queryText, candidates)
    let matchesCreated = 0
    const scoredListings = listings
      .map(l => ({ listing: l, rawScore: scores[l.id] ?? 0 }))
      .filter(x => x.rawScore >= MATCH_THRESHOLD)
      .sort((a, b) => b.rawScore - a.rawScore)

    for (let rank = 0; rank < scoredListings.length; rank++) {
      const { listing, rawScore } = scoredListings[rank]

      const existing = await this.prisma.match.findUnique({
        where: {
          demandRequestId_productListingId: {
            demandRequestId:  demandId,
            productListingId: listing.id,
          },
        },
      })
      if (existing) continue

      const penalties = this.computePenalties(demand as any, listing as any)
      const finalScore = rawScore * penalties.total
      const matchScore = Math.round(finalScore * 100)

      const match = await this.prisma.match.create({
        data: {
          demandRequestId:  demandId,
          productListingId: listing.id,
          matchScore,
          matchConfidence:  this.toConfidence(matchScore),
          scoreBreakdown:   {
            textScore:    rawScore,
            finalScore,
            penalties:    penalties.breakdown,
          } as any,
          missingInfoFlags: this.buildMissingFlags(demand as any, listing as any),
          status:           'proposed',
        },
      })

      // Save MatchSnapshot for LTR training data
      await this.prisma.matchSnapshot.create({
        data: {
          matchId:         match.id,
          rankPosition:    rank + 1,
          candidateSetSize: scoredListings.length,
          textScore:       rawScore,
          visualScore:     null,
          finalScore,
          penaltiesApplied: penalties.breakdown as any,
          demandSnapshot:   this.snapshotDemand(demand as any),
          listingSnapshot:  this.snapshotListing(listing as any),
          featureVector:    this.buildFeatureVector(demand as any, listing as any, rawScore, finalScore),
        },
      })

      matchesCreated++

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

    await this.saveLog('demand', demandId, queryText, candidates.length, rawResults, matchesCreated)
  }

  /**
   * Called when a listing is published.
   * Scores the listing against all active demands in the same category via AI.
   */
  async runForListing(listingId: string): Promise<void> {
    const listing = await this.prisma.productListing.findUnique({
      where: { id: listingId },
      include: { sellerProfile: true, proofAssets: true, category: true },
    })
    if (!listing || listing.status !== 'active') return

    const demands = await this.prisma.demandRequest.findMany({
      where: {
        status:       { in: ['active', 'waiting'] },
        categoryId:   listing.categoryId,
        buyerProfile: { userId: { not: listing.sellerProfile.userId } },
      },
      include: { buyerProfile: true, category: true },
    })
    if (demands.length === 0) return

    const queryText  = this.buildListingText(listing as any)
    const candidates = demands.map(d => ({
      id:   d.id,
      text: this.buildDemandText(d as any),
    }))

    const { scores, rawResults } = await this.scoreWithAI(queryText, candidates)
    let matchesCreated = 0
    const scoredDemands = demands
      .map(d => ({ demand: d, rawScore: scores[d.id] ?? 0 }))
      .filter(x => x.rawScore >= MATCH_THRESHOLD)
      .sort((a, b) => b.rawScore - a.rawScore)

    for (let rank = 0; rank < scoredDemands.length; rank++) {
      const { demand, rawScore } = scoredDemands[rank]

      const existing = await this.prisma.match.findUnique({
        where: {
          demandRequestId_productListingId: {
            demandRequestId:  demand.id,
            productListingId: listingId,
          },
        },
      })
      if (existing) continue

      const penalties = this.computePenalties(demand as any, listing as any)
      const finalScore = rawScore * penalties.total
      const matchScore = Math.round(finalScore * 100)

      const match = await this.prisma.match.create({
        data: {
          demandRequestId:  demand.id,
          productListingId: listingId,
          matchScore,
          matchConfidence:  this.toConfidence(matchScore),
          scoreBreakdown:   {
            textScore:    rawScore,
            finalScore,
            penalties:    penalties.breakdown,
          } as any,
          missingInfoFlags: this.buildMissingFlags(demand as any, listing as any),
          status:           'proposed',
        },
      })

      // Save MatchSnapshot for LTR training data
      await this.prisma.matchSnapshot.create({
        data: {
          matchId:          match.id,
          rankPosition:     rank + 1,
          candidateSetSize: scoredDemands.length,
          textScore:        rawScore,
          visualScore:      null,
          finalScore,
          penaltiesApplied: penalties.breakdown as any,
          demandSnapshot:   this.snapshotDemand(demand as any),
          listingSnapshot:  this.snapshotListing(listing as any),
          featureVector:    this.buildFeatureVector(demand as any, listing as any, rawScore, finalScore),
        },
      })

      matchesCreated++

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

    await this.saveLog('listing', listingId, queryText, candidates.length, rawResults, matchesCreated)
  }

  // ─── AI SCORING ────────────────────────────────────────────────────────────

  private async scoreWithAI(
    queryText:  string,
    candidates: Array<{ id: string; text: string }>,
  ): Promise<{ scores: Record<string, number>; rawResults: any[] }> {
    if (candidates.length === 0) return { scores: {}, rawResults: [] }

    try {
      const data = await this.ai.scorePairs(queryText, candidates) as { results: Array<{ id: string; score: number }> }
      const scores: Record<string, number> = {}
      for (const r of data.results) scores[r.id] = r.score
      return { scores, rawResults: data.results }
    } catch (err) {
      this.logger.warn(`AI service unreachable: ${(err as Error).message}`)
      return { scores: {}, rawResults: [] }
    }
  }

  private async saveLog(
    triggeredBy:    string,
    sourceId:       string,
    sourceText:     string,
    candidateCount: number,
    rawResults:     any[],
    matchesCreated: number,
  ): Promise<void> {
    try {
      await this.prisma.aiMatchLog.create({
        data: {
          triggeredBy,
          sourceId,
          sourceText,
          candidateCount,
          results:        rawResults as any,
          matchesCreated,
        },
      })
    } catch (err) {
      this.logger.warn(`Failed to save AI match log: ${(err as Error).message}`)
    }
  }

  // ─── TEXT BUILDERS (structured format for stable scoring) ──────────────────

  private buildDemandText(demand: any): string {
    const lines: string[] = []
    lines.push(`title: ${demand.title}`)
    if (demand.category?.name)       lines.push(`category: ${demand.category.name}`)
    if (demand.description)          lines.push(`description: ${demand.description}`)
    if (demand.preferredCondition)   lines.push(`condition: ${demand.preferredCondition.replace(/_/g, ' ')}`)
    if (demand.location)             lines.push(`location: ${demand.location}`)
    if (demand.budgetMin != null && demand.budgetMax != null)
      lines.push(`budget: ${Number(demand.budgetMin).toLocaleString()}–${Number(demand.budgetMax).toLocaleString()} VND`)
    else if (demand.budgetMax != null)
      lines.push(`budget: under ${Number(demand.budgetMax).toLocaleString()} VND`)
    const full = lines.join('\n')
    return full.length <= 512 ? full : full.slice(0, 512)
  }

  private buildListingText(listing: any): string {
    const lines: string[] = []
    lines.push(`title: ${listing.title}`)
    if (listing.category?.name)      lines.push(`category: ${listing.category.name}`)
    if (listing.description)         lines.push(`description: ${listing.description}`)
    if (listing.condition)           lines.push(`condition: ${listing.condition.replace(/_/g, ' ')}`)
    if (listing.conditionNotes)      lines.push(`condition_notes: ${listing.conditionNotes}`)
    if (listing.location)            lines.push(`location: ${listing.location}`)
    if (listing.priceExpectation != null)
      lines.push(`price: ${Number(listing.priceExpectation).toLocaleString()} VND`)

    const visionParts: string[] = []
    for (const asset of listing.proofAssets ?? []) {
      const ai = asset.aiAttributes as any
      if (!ai?.attributes) continue
      if (ai.attributes.detailed_caption) visionParts.push(ai.attributes.detailed_caption)
      if (ai.attributes.ocr)              visionParts.push(ai.attributes.ocr)
      if (ai.attributes.object_detection) visionParts.push(ai.attributes.object_detection)
    }
    if (visionParts.length > 0) {
      const visionText = visionParts.join(' | ')
      lines.push(`vision: ${visionText.slice(0, 200)}`)
    }

    // Enforce 512-char hard limit (SentenceTransformer /score-pairs constraint)
    const full = lines.join('\n')
    return full.length <= 512 ? full : full.slice(0, 512)
  }

  // ─── PENALTY CALCULATION ───────────────────────────────────────────────────

  private computePenalties(
    demand:  any,
    listing: any,
  ): { total: number; breakdown: Record<string, number> } {
    const breakdown: Record<string, number> = {}

    // Price penalty: listing price > buyer's max budget
    if (demand.budgetMax != null && listing.priceExpectation != null) {
      const price  = Number(listing.priceExpectation)
      const budget = Number(demand.budgetMax)
      if (price > budget * 1.2) {
        breakdown.price = 0.4  // severely over budget
      } else if (price > budget) {
        breakdown.price = 0.75 // slightly over budget
      }
    }

    // Condition penalty: listing is worse than buyer's minimum preference
    if (demand.preferredCondition && listing.condition) {
      const preferredIdx = CONDITION_ORDER.indexOf(demand.preferredCondition)
      const actualIdx    = CONDITION_ORDER.indexOf(listing.condition)
      if (preferredIdx > 0 && actualIdx >= 0 && actualIdx < preferredIdx) {
        const gap = preferredIdx - actualIdx
        breakdown.condition = gap >= 2 ? 0.5 : 0.8
      }
    }

    const total = Object.values(breakdown).reduce((acc, v) => acc * v, 1.0)
    return { total, breakdown }
  }

  // ─── SNAPSHOT HELPERS ──────────────────────────────────────────────────────

  private snapshotDemand(demand: any): object {
    return {
      title:              demand.title,
      category:           demand.category?.name ?? demand.categoryId,
      description:        demand.description ?? null,
      budgetMin:          demand.budgetMin  != null ? Number(demand.budgetMin)  : null,
      budgetMax:          demand.budgetMax  != null ? Number(demand.budgetMax)  : null,
      preferredCondition: demand.preferredCondition ?? null,
      location:           demand.location ?? null,
    }
  }

  private snapshotListing(listing: any): object {
    return {
      title:      listing.title,
      category:   listing.category?.name ?? listing.categoryId,
      description: listing.description ?? null,
      price:      listing.priceExpectation != null ? Number(listing.priceExpectation) : null,
      condition:  listing.condition ?? null,
      location:   listing.location ?? null,
      hasImage:   (listing.proofAssets?.length ?? 0) > 0,
      imageCount: listing.proofAssets?.length ?? 0,
      hasVision:  (listing.proofAssets ?? []).some((a: any) => a.aiAttributes?.attributes),
    }
  }

  private buildFeatureVector(demand: any, listing: any, textScore: number, finalScore: number): object {
    const condIdx  = listing.condition   ? CONDITION_ORDER.indexOf(listing.condition)           : -1
    const prefIdx  = demand.preferredCondition ? CONDITION_ORDER.indexOf(demand.preferredCondition) : -1

    let priceRatio: number | null = null
    if (demand.budgetMax != null && listing.priceExpectation != null) {
      priceRatio = Number(listing.priceExpectation) / Number(demand.budgetMax)
    }

    return {
      textScore,
      finalScore,
      priceRatio,
      conditionMatch:   prefIdx >= 0 && condIdx >= 0 ? (condIdx >= prefIdx ? 1 : 0) : null,
      conditionGap:     prefIdx >= 0 && condIdx >= 0 ? (condIdx - prefIdx) : null,
      hasImage:         (listing.proofAssets?.length ?? 0) > 0 ? 1 : 0,
      hasVision:        (listing.proofAssets ?? []).some((a: any) => a.aiAttributes?.attributes) ? 1 : 0,
      hasBudget:        demand.budgetMax != null ? 1 : 0,
      hasConditionPref: demand.preferredCondition ? 1 : 0,
    }
  }

  // ─── HELPERS ───────────────────────────────────────────────────────────────

  private toConfidence(score: number): 'high' | 'medium' | 'low' {
    if (score >= 75) return 'high'
    if (score >= 50) return 'medium'
    return 'low'
  }

  private buildMissingFlags(demand: any, listing: any): string[] {
    const flags: string[] = []
    if (!listing.description)                flags.push('no_listing_description')
    if (!demand.description)                 flags.push('no_demand_description')
    if ((listing.proofAssets?.length ?? 0) === 0) flags.push('no_listing_images')
    if (listing.proofCompletenessScore < 60) flags.push('low_proof_score')
    if (!listing.location)                   flags.push('no_listing_location')
    if (!demand.location)                    flags.push('no_demand_location')
    return flags
  }
}
