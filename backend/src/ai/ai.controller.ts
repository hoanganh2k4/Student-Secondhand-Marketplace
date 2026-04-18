import { ApiTags, ApiBearerAuth, ApiQuery, ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { Controller, Get, Post, Body, Query, Param, UseGuards, DefaultValuePipe, ParseIntPipe } from '@nestjs/common'
import { JwtAuthGuard }  from '../auth/guards/jwt-auth.guard'
import { AdminGuard }    from '../admin/admin.guard'
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

  @Get('health')
  @ApiOperation({ summary: 'AI service health check', description: 'Returns which models are loaded: sentence encoder, CLIP, Florence-2, and whether the FAISS pipeline is ready.' })
  @ApiResponse({ status: 200, description: '{ status, stage0_ready, pipeline_ready, sentence_encoder_loaded, vision_enabled }' })
  health() {
    return this.ai.health()
  }

  @Get('stats')
  @ApiOperation({ summary: 'AI service stats', description: 'Returns FAISS index sizes, sub-index breakdown, and model flags.' })
  @ApiResponse({ status: 200, description: 'Index stats from AI service' })
  stats() {
    return this.ai.stats()
  }

  // ── Stage 0 — Query Understanding ───────────────────────────────────────────

  @Post('parse')
  @ApiOperation({ summary: 'Stage 0: Parse query into structured constraints', description: 'Extracts hard constraints (price, condition_floor) and soft preferences (color, size, gender, brand) from free-text. No FAISS index required.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['query'],
      properties: {
        query: { type: 'string', example: 'Cần áo khoác nữ màu đen size L dưới 300k còn mới' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'ParsedQuery with hard_constraints, soft_preferences, keywords, enriched_query' })
  parseQuery(@Body('query') query: string) {
    return this.ai.parseQuery(query)
  }

  @Post('keywords')
  @ApiOperation({ summary: 'Stage 0: Extract KeyBERT keywords only', description: 'Faster than /parse — use for autocomplete or search-as-you-type.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['text'],
      properties: {
        text:  { type: 'string', example: 'laptop cũ budget 5 triệu còn tốt' },
        top_n: { type: 'number', example: 5, description: 'Number of keywords to return (default 6)' },
      },
    },
  })
  @ApiResponse({ status: 201, description: '{ keywords: string[] }' })
  extractKeywords(
    @Body('text')  text:  string,
    @Body('top_n') top_n: number,
  ) {
    return this.ai.extractKeywords(text, top_n ?? 6)
  }

  // ── Full Pipeline ────────────────────────────────────────────────────────────

  @Post('search')
  @ApiOperation({ summary: 'Full 4-stage pipeline search', description: 'Stages 0 → 1 → 2 → 3: parse → route → retrieve → rerank. Requires FAISS index to be built.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['query'],
      properties: {
        query: { type: 'string', example: 'Cần áo khoác nữ màu đen size L dưới 300k còn mới' },
        top_k: { type: 'number', example: 10, description: 'Number of results to return (default 10)' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Array of results with rerank_score, why_this_result, and timings' })
  search(
    @Body('query') query: string,
    @Body('top_k') top_k: number,
  ) {
    return this.ai.search(query, top_k ?? 10)
  }

  @Post('retrieve')
  @ApiOperation({ summary: 'Stages 0+1+2 retrieval only (no reranking)', description: 'Returns raw candidates from FAISS + BM25 before Stage 3 reranking. Useful for debugging recall.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['query'],
      properties: {
        query: { type: 'string', example: 'laptop sinh viên giá rẻ' },
        top_k: { type: 'number', example: 20 },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Candidates with retrieval_score (RRF) before reranking' })
  retrieve(
    @Body('query') query: string,
    @Body('top_k') top_k: number,
  ) {
    return this.ai.retrieve(query, top_k ?? 20)
  }

  // ── Matching ─────────────────────────────────────────────────────────────────

  @Post('score-pairs')
  @ApiOperation({ summary: 'Pairwise semantic similarity scoring', description: 'Used by the matching engine. Encodes query + candidate texts with SentenceTransformer, returns cosine similarity scores sorted descending. Works without FAISS index.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['query', 'candidates'],
      properties: {
        query: {
          type: 'string',
          example: 'title: Cần laptop sinh viên\ncategory: Laptop\ndescription: Dùng lập trình, budget 8 triệu',
        },
        candidates: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id:   { type: 'string', example: 'listing-uuid-here' },
              text: { type: 'string', example: 'title: MacBook Air M1\ncategory: Laptop\ndescription: Máy đẹp, pin tốt, 8GB RAM' },
            },
          },
          example: [
            { id: 'uuid-1', text: 'title: MacBook Air M1\ncategory: Laptop\ndescription: Máy đẹp, pin tốt' },
            { id: 'uuid-2', text: 'title: Áo khoác nam\ncategory: Thời trang\ndescription: Bomber đen' },
          ],
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: '{ results: [{id, score}], total, latency_ms } — sorted by score descending' })
  scorePairs(
    @Body('query')      query:      string,
    @Body('candidates') candidates: Array<{ id: string; text: string }>,
  ) {
    return this.ai.scorePairs(query, candidates)
  }

  // ── Vision ───────────────────────────────────────────────────────────────────

  @Post('vision/filter')
  @ApiOperation({ summary: 'CLIP: filter images by text query similarity', description: 'Uses CLIP ViT-L/14 to score each image against the text query. Returns only images above the threshold.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['image_urls', 'query'],
      properties: {
        image_urls: { type: 'array', items: { type: 'string' }, example: ['http://localhost:9000/marketplace-assets/listings/img1.jpg'] },
        query:      { type: 'string', example: 'laptop sinh viên' },
        threshold:  { type: 'number', example: 0.20, description: 'Min cosine similarity to include (default 0.20)' },
      },
    },
  })
  @ApiResponse({ status: 201, description: '{ results: [{url, score}], latency_ms }' })
  visionFilter(
    @Body('image_urls') image_urls: string[],
    @Body('query')      query:      string,
    @Body('threshold')  threshold:  number,
  ) {
    return this.ai.visionFilter(image_urls, query, threshold ?? 0.20)
  }

  @Post('vision/score')
  @ApiOperation({ summary: 'CLIP: raw similarity scores for all images (no threshold)', description: 'Returns a score for every image including those below threshold. Useful for debugging or building confidence bars.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['image_urls', 'query'],
      properties: {
        image_urls: { type: 'array', items: { type: 'string' }, example: ['http://localhost:9000/marketplace-assets/listings/img1.jpg'] },
        query:      { type: 'string', example: 'laptop silver' },
      },
    },
  })
  @ApiResponse({ status: 201, description: '{ results: [{url, score}], latency_ms }' })
  visionScore(
    @Body('image_urls') image_urls: string[],
    @Body('query')      query:      string,
  ) {
    return this.ai.visionScore(image_urls, query)
  }

  @Post('vision/extract')
  @ApiOperation({ summary: 'Florence-2: extract attributes from a product image', description: 'Uses Florence-2-base (232M params) to extract caption, OCR text, object detection labels from a listing image. Results are used as the vision: field in listing text for /score-pairs.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['image_url'],
      properties: {
        image_url: { type: 'string', example: 'http://localhost:9000/marketplace-assets/listings/macbook-abc123.jpg' },
        tasks: {
          type: 'array',
          items: { type: 'string', enum: ['caption', 'detailed_caption', 'ocr', 'object_detection', 'dense_caption'] },
          example: ['caption', 'ocr'],
          description: 'Florence-2 tasks to run (default: ["caption", "ocr"])',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: '{ attributes: { caption, ocr, ... }, latency_ms }' })
  visionExtract(
    @Body('image_url') image_url: string,
    @Body('tasks')     tasks:     string[],
  ) {
    return this.ai.visionExtract(image_url, tasks ?? ['caption', 'ocr'])
  }

  @Post('vision/listing-context')
  @ApiOperation({ summary: 'Florence-2: generate text context from all listing images', description: 'Runs detailed_caption + OCR on each image and concatenates results. Use the output to enrich listing text before FAISS reindexing.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['image_urls'],
      properties: {
        image_urls: {
          type: 'array',
          items: { type: 'string' },
          example: [
            'http://localhost:9000/marketplace-assets/listings/img1.jpg',
            'http://localhost:9000/marketplace-assets/listings/img2.jpg',
          ],
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: '{ contexts: string[] } — one context string per image' })
  visionListingContext(@Body('image_urls') image_urls: string[]) {
    return this.ai.visionListingContext(image_urls)
  }

  // ── Match Logs (admin only) ──────────────────────────────────────────────────

  @Get('match-logs')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'List AI match run logs', description: 'Each row = one matching engine run: source demand/listing, how many candidates were scored, how many matches were created.' })
  @ApiQuery({ name: 'limit',       required: false, example: 20 })
  @ApiQuery({ name: 'offset',      required: false, example: 0 })
  @ApiQuery({
    name: 'triggeredBy', required: false,
    enum: ['demand', 'listing'],
    description: 'Filter by what triggered the match run',
  })
  @ApiResponse({ status: 200, description: '{ total, limit, offset, logs: AiMatchLog[] }' })
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

  @Get('match-logs/:id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get a single match log with full AI results array' })
  @ApiResponse({ status: 200, description: 'AiMatchLog with sourceText, results array, and match count' })
  matchLog(@Param('id') id: string) {
    return this.prisma.aiMatchLog.findUniqueOrThrow({ where: { id } })
  }

  // ── Training Data (admin only) ───────────────────────────────────────────────

  @Get('training-data')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Export LTR training data (paginated)', description: 'Each row = one MatchSnapshot joined with its aggregated interaction label. label=null means no interactions yet.' })
  @ApiQuery({ name: 'limit',    required: false, example: 50 })
  @ApiQuery({ name: 'offset',   required: false, example: 0 })
  @ApiQuery({ name: 'demandId', required: false, description: 'Filter to a single demand group' })
  @ApiResponse({ status: 200, description: '{ total, rows: [{ snapshotId, demandId, listingId, featureVector, label, interactions }] }' })
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

  @Get('training-data/export')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Export training data as JSONL for XGBoost LambdaRank', description: 'Each row has qid (demandId for grouping), label (0–1), features (flat array), featureNames. Feed directly to train_ltr.py.' })
  @ApiQuery({ name: 'minLabel', required: false, example: 0, description: 'Minimum label threshold (0–1). Use 0.5 to export only positive examples.' })
  @ApiResponse({ status: 200, description: '{ count, rows: [{ qid, label, features, featureNames, snapshotId }] }' })
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
          ? 0.2
          : interactions.reduce((best, i) => Math.max(best, ACTION_SCORE[i.action] ?? 0.2), 0.2)

        const fv = s.featureVector as Record<string, any>
        return {
          qid:              s.match.demandRequestId,
          label,
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
          featureNames: ['textScore','finalScore','priceRatio','conditionMatch','conditionGap',
                         'hasImage','hasVision','hasBudget','hasConditionPref','rankPosition','candidateSetSize'],
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

  @Get('training-data/stats')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Training data coverage stats', description: 'Shows label distribution, how many snapshots have interactions, and breakdown by action type and model version.' })
  @ApiResponse({ status: 200, description: '{ totalSnapshots, totalInteractions, coverageRate, byAction, byModelVersion }' })
  async trainingDataStats() {
    const [totalSnapshots, totalInteractions, byModelVersion] = await Promise.all([
      this.prisma.matchSnapshot.count(),
      this.prisma.matchInteraction.count(),
      this.prisma.matchSnapshot.groupBy({
        by:     ['modelVersion'],
        _count: { id: true },
      }),
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

  // ── Call Logs (admin only) ────────────────────────────────────────────────────

  @Get('call-logs')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'List AI service call logs', description: 'Every call from the backend to the FastAPI AI service is logged. Shows endpoint, latency, and error (if any). inputData/outputData only available in the detail endpoint.' })
  @ApiQuery({ name: 'limit',  required: false, example: 20 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  @ApiQuery({
    name: 'endpoint', required: false,
    enum: ['/score-pairs','/vision/extract','/vision/filter','/vision/score','/vision/listing-context','/stage0/parse','/stage0/keywords','/stage1/route','/stage2/retrieve','/search'],
    description: 'Filter by AI service endpoint',
  })
  @ApiResponse({ status: 200, description: '{ total, limit, offset, logs: [{ id, endpoint, latencyMs, error, createdAt }] }' })
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
        },
      }),
      this.prisma.aiCallLog.count({ where }),
    ])
    return { total, limit, offset, logs }
  }

  @Get('call-logs/:id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get full call log with inputData and outputData' })
  @ApiResponse({ status: 200, description: 'AiCallLog with full inputData and outputData' })
  callLog(@Param('id') id: string) {
    return this.prisma.aiCallLog.findUniqueOrThrow({ where: { id } })
  }
}
