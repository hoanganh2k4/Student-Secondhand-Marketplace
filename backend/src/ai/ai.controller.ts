import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { Controller, Get, Post, Body, Query, Param, UseGuards, DefaultValuePipe, ParseIntPipe } from '@nestjs/common'
import { JwtAuthGuard }  from '../auth/guards/jwt-auth.guard'
import { AiService }     from './ai.service'
import { PrismaService } from '../prisma/prisma.service'


@ApiBearerAuth('access-token')
@ApiTags('AI')
@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly ai:     AiService,
    private readonly prisma: PrismaService,
  ) {}

  // ── System ──────────────────────────────────────────────────────────────────

  /** GET /api/ai/health — AI service health + which models are loaded */
  @Get('health')
  health() {
    return this.ai.health()
  }

  /** GET /api/ai/stats — FAISS index sizes, model flags */
  @Get('stats')
  stats() {
    return this.ai.stats()
  }

  // ── Stage 0 — Query Understanding ───────────────────────────────────────────

  /**
   * POST /api/ai/parse
   * Body: { query: string }
   * Full Stage 0: hard constraints (price, condition) + soft prefs + keywords
   */
  @Post('parse')
  parseQuery(@Body('query') query: string) {
    return this.ai.parseQuery(query)
  }

  /**
   * POST /api/ai/keywords
   * Body: { text: string, top_n?: number }
   * KeyBERT keyword extraction only (faster than /parse)
   */
  @Post('keywords')
  extractKeywords(
    @Body('text')  text:  string,
    @Body('top_n') top_n: number,
  ) {
    return this.ai.extractKeywords(text, top_n ?? 6)
  }

  // ── Full Pipeline ────────────────────────────────────────────────────────────

  /**
   * POST /api/ai/search
   * Body: { query: string, top_k?: number }
   * Full 4-stage pipeline: parse → route → retrieve → rerank
   * Requires FAISS index to be built.
   */
  @Post('search')
  search(
    @Body('query') query: string,
    @Body('top_k') top_k: number,
  ) {
    return this.ai.search(query, top_k ?? 10)
  }

  /**
   * POST /api/ai/retrieve
   * Body: { query: string, top_k?: number }
   * Stages 0+1+2 only — retrieval before reranking (debug use)
   */
  @Post('retrieve')
  retrieve(
    @Body('query') query: string,
    @Body('top_k') top_k: number,
  ) {
    return this.ai.retrieve(query, top_k ?? 20)
  }

  // ── Matching ─────────────────────────────────────────────────────────────────

  /**
   * POST /api/ai/score-pairs
   * Body: { query: string, candidates: Array<{ id: string, text: string }> }
   * Pairwise cosine similarity — used by matching engine, also callable directly
   */
  @Post('score-pairs')
  scorePairs(
    @Body('query')      query:      string,
    @Body('candidates') candidates: Array<{ id: string; text: string }>,
  ) {
    return this.ai.scorePairs(query, candidates)
  }

  // ── Vision ───────────────────────────────────────────────────────────────────

  /**
   * POST /api/ai/vision/filter
   * Body: { image_urls: string[], query: string, threshold?: number }
   * CLIP ViT-L/14: filter images by similarity to text query
   */
  @Post('vision/filter')
  visionFilter(
    @Body('image_urls') image_urls: string[],
    @Body('query')      query:      string,
    @Body('threshold')  threshold:  number,
  ) {
    return this.ai.visionFilter(image_urls, query, threshold ?? 0.20)
  }

  /**
   * POST /api/ai/vision/score
   * Body: { image_urls: string[], query: string }
   * CLIP ViT-L/14: raw similarity scores for all images (no threshold)
   */
  @Post('vision/score')
  visionScore(
    @Body('image_urls') image_urls: string[],
    @Body('query')      query:      string,
  ) {
    return this.ai.visionScore(image_urls, query)
  }

  /**
   * POST /api/ai/vision/extract
   * Body: { image_url: string, tasks?: string[] }
   * Florence-2-base: extract caption, OCR, object detection, etc.
   * tasks: 'caption' | 'detailed_caption' | 'ocr' | 'object_detection' | 'dense_caption'
   */
  @Post('vision/extract')
  visionExtract(
    @Body('image_url') image_url: string,
    @Body('tasks')     tasks:     string[],
  ) {
    return this.ai.visionExtract(image_url, tasks ?? ['caption', 'ocr'])
  }

  /**
   * POST /api/ai/vision/listing-context
   * Body: { image_urls: string[] }
   * Florence-2-base: generate text context from listing images for FAISS indexing
   */
  @Post('vision/listing-context')
  visionListingContext(@Body('image_urls') image_urls: string[]) {
    return this.ai.visionListingContext(image_urls)
  }

  // ── Match Logs ───────────────────────────────────────────────────────────────

  /**
   * GET /api/ai/match-logs
   * Query: ?limit=20&offset=0&triggeredBy=demand|listing
   * List AI match logs — shows what the AI scored, how many matches were created.
   */
  @Get('match-logs')
  @ApiQuery({
    name: 'triggeredBy', required: false,
    enum: ['demand', 'listing'],
    description: 'Filter by what triggered the match run',
  })
  async matchLogs(
    @Query('limit',  new DefaultValuePipe(20),  ParseIntPipe) limit:  number,
    @Query('offset', new DefaultValuePipe(0),   ParseIntPipe) offset: number,
    @Query('triggeredBy') triggeredBy?: string,
  ) {
    const where = triggeredBy ? { triggeredBy } : {}
    const [logs, total] = await Promise.all([
      this.prisma.aiMatchLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take:    limit,
        skip:    offset,
      }),
      this.prisma.aiMatchLog.count({ where }),
    ])
    return { total, limit, offset, logs }
  }

  /**
   * GET /api/ai/match-logs/:id
   * Full log entry including raw AI results array.
   */
  @Get('match-logs/:id')
  matchLog(@Param('id') id: string) {
    return this.prisma.aiMatchLog.findUniqueOrThrow({ where: { id } })
  }

  // ── Training Data ────────────────────────────────────────────────────────────

  /**
   * GET /api/ai/training-data
   * Export LTR training data: snapshots joined with aggregated interaction labels.
   * Each row = one (demandId, listingId) pair with feature vector + label.
   * Query params: ?demandId=...  (single demand group) or full export with limit/offset
   */
  @Get('training-data')
  @ApiQuery({ name: 'demandId', required: false, description: 'Export one demand group' })
  async trainingData(
    @Query('limit',    new DefaultValuePipe(200), ParseIntPipe) limit:    number,
    @Query('offset',   new DefaultValuePipe(0),   ParseIntPipe) offset:   number,
    @Query('demandId') demandId?: string,
  ) {
    const where = demandId
      ? { match: { demandRequestId: demandId } }
      : {}

    const snapshots = await this.prisma.matchSnapshot.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take:    limit,
      skip:    offset,
      include: {
        match: {
          select: {
            demandRequestId:  true,
            productListingId: true,
            matchScore:       true,
            // Join interactions via matchId (not snapshotId) to catch all auto-logged events
            interactions: { select: { action: true, userId: true, createdAt: true } },
          },
        },
      },
    })

    const ACTION_SCORE: Record<string, number> = {
      ordered: 1.0, offered: 0.9, messaged: 0.7,
      accepted: 0.5, dismissed: 0.0,
      detail_viewed: 0.3, impressed: 0.2,
    }

    const rows = snapshots.map(s => {
      const interactions = s.match.interactions ?? []
      const maxLabel = interactions.length === 0
        ? null
        : interactions.reduce((best, i) => Math.max(best, ACTION_SCORE[i.action] ?? 0.2), 0.2)

      return {
        snapshotId:       s.id,
        matchId:          s.matchId,
        demandId:         s.match.demandRequestId,
        listingId:        s.match.productListingId,
        modelVersion:     s.modelVersion,
        rankPosition:     s.rankPosition,
        candidateSetSize: s.candidateSetSize,
        featureVector:    s.featureVector,
        textScore:        s.textScore,
        visualScore:      s.visualScore,
        finalScore:       s.finalScore,
        penaltiesApplied: s.penaltiesApplied,
        label:            maxLabel,
        interactionCount: interactions.length,
        interactions,
        createdAt:        s.createdAt,
      }
    })

    return { total: rows.length, limit, offset, rows }
  }

  /**
   * GET /api/ai/training-data/export
   * Export full LTR dataset as JSONL — one row per match snapshot with label.
   * Download and feed directly into Python training script.
   * Query: ?minLabel=0.5 to export only positive examples
   */
  @Get('training-data/export')
  @ApiQuery({ name: 'minLabel', required: false, description: 'Minimum label threshold (0–1)', example: 0 })
  async trainingDataExport(
    @Query('minLabel', new DefaultValuePipe(0)) minLabel: number,
  ) {
    const snapshots = await this.prisma.matchSnapshot.findMany({
      include: {
        match: {
          select: {
            demandRequestId:  true,
            productListingId: true,
            interactions: { select: { action: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const ACTION_SCORE: Record<string, number> = {
      ordered: 1.0, offered: 0.9, messaged: 0.7,
      accepted: 0.5, dismissed: 0.0,
      detail_viewed: 0.3, impressed: 0.2,
    }

    const rows = snapshots
      .map(s => {
        const interactions = s.match.interactions ?? []
        const label = interactions.length === 0
          ? 0.2  // exposed but no action = weak negative
          : interactions.reduce((best, i) => Math.max(best, ACTION_SCORE[i.action] ?? 0.2), 0.2)

        const fv = s.featureVector as Record<string, any>
        return {
          // Query group (for LambdaRank grouping)
          qid:              s.match.demandRequestId,
          // Label (0.0 – 1.0)
          label,
          // Features (flat array, order matters for model)
          features: [
            fv.textScore        ?? 0,
            fv.finalScore       ?? 0,
            fv.priceRatio       ?? 1,
            fv.conditionMatch   ?? 0,
            fv.conditionGap     ?? 0,
            fv.hasImage         ?? 0,
            fv.hasVision        ?? 0,
            fv.hasBudget        ?? 0,
            fv.hasConditionPref ?? 0,
            s.rankPosition,
            s.candidateSetSize,
          ],
          // Feature names for debugging
          featureNames: ['textScore','finalScore','priceRatio','conditionMatch','conditionGap',
                         'hasImage','hasVision','hasBudget','hasConditionPref','rankPosition','candidateSetSize'],
          // Metadata
          snapshotId:   s.id,
          matchId:      s.matchId,
          listingId:    s.match.productListingId,
          modelVersion: s.modelVersion,
          createdAt:    s.createdAt,
        }
      })
      .filter(r => r.label >= Number(minLabel))

    return { count: rows.length, rows }
  }

  /**
   * GET /api/ai/training-data/stats
   * Aggregated stats: label distribution, coverage, model version counts.
   */
  @Get('training-data/stats')
  async trainingDataStats() {
    const [totalSnapshots, totalInteractions, byModelVersion] = await Promise.all([
      this.prisma.matchSnapshot.count(),
      this.prisma.matchInteraction.count(),
      this.prisma.matchSnapshot.groupBy({
        by:     ['modelVersion'],
        _count: { id: true },
      }),
      // interaction counts by action
    ])
    const byAction = await this.prisma.matchInteraction.groupBy({
      by:     ['action'],
      _count: { id: true },
    })
    const snapshotsWithInteraction = await this.prisma.matchSnapshot.count({
      where: { interactions: { some: {} } },
    })
    return {
      totalSnapshots,
      totalInteractions,
      snapshotsWithInteraction,
      coverageRate: totalSnapshots > 0
        ? Math.round((snapshotsWithInteraction / totalSnapshots) * 100) / 100
        : 0,
      byModelVersion: Object.fromEntries(byModelVersion.map(r => [r.modelVersion, r._count.id])),
      byAction:       Object.fromEntries(byAction.map(r => [r.action, r._count.id])),
    }
  }

  // ── Call Logs ─────────────────────────────────────────────────────────────────

  /**
   * GET /api/ai/call-logs
   * Query: ?limit=20&offset=0&endpoint=/score-pairs
   * List all raw AI service call logs — input, output, latency, errors.
   */
  @Get('call-logs')
  @ApiQuery({
    name: 'endpoint', required: false,
    enum: [
      '/score-pairs',
      '/vision/extract',
      '/vision/filter',
      '/vision/score',
      '/vision/listing-context',
      '/stage0/parse',
      '/stage0/keywords',
      '/stage1/route',
      '/stage2/retrieve',
      '/search',
    ],
    description: 'Filter by AI service endpoint',
  })
  async callLogs(
    @Query('limit',    new DefaultValuePipe(20), ParseIntPipe) limit:    number,
    @Query('offset',   new DefaultValuePipe(0),  ParseIntPipe) offset:   number,
    @Query('endpoint') endpoint?: string,
  ) {
    const normalizedEndpoint = endpoint
      ? (endpoint.startsWith('/') ? endpoint : `/${endpoint}`)
      : undefined
    const where = normalizedEndpoint ? { endpoint: normalizedEndpoint } : {}
    const [logs, total] = await Promise.all([
      this.prisma.aiCallLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take:    limit,
        skip:    offset,
        select: {
          id:        true,
          endpoint:  true,
          latencyMs: true,
          error:     true,
          createdAt: true,
          // omit inputData/outputData from list view — fetch via /:id
        },
      }),
      this.prisma.aiCallLog.count({ where }),
    ])
    return { total, limit, offset, logs }
  }

  /**
   * GET /api/ai/call-logs/:id
   * Full call log entry including inputData and outputData.
   */
  @Get('call-logs/:id')
  callLog(@Param('id') id: string) {
    return this.prisma.aiCallLog.findUniqueOrThrow({ where: { id } })
  }
}
