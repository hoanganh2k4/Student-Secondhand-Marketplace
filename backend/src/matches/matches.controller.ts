import { ApiTags, ApiBearerAuth, ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common'
import { JwtAuthGuard }  from '../auth/guards/jwt-auth.guard'
import { MatchesService } from './matches.service'

const MATCH_EXAMPLE = {
  id: 'match-uuid-here',
  demandRequestId: 'demand-uuid-here',
  productListingId: 'listing-uuid-here',
  matchScore: 78,
  matchConfidence: 'high',
  scoreBreakdown: { textScore: 0.7695, finalScore: 0.7695, penalties: {} },
  missingInfoFlags: [],
  status: 'proposed',
  buyerAcknowledged: false,
  sellerAcknowledged: false,
  createdAt: '2026-04-11T10:00:00.000Z',
  demandRequest: {
    id: 'demand-uuid-here',
    title: 'Cần mua laptop sinh viên',
    budgetMin: '5000000',
    budgetMax: '10000000',
    preferredCondition: 'good',
    buyerProfile: { userId: 'buyer-user-uuid' },
  },
  productListing: {
    id: 'listing-uuid-here',
    title: 'MacBook Air M1',
    priceExpectation: '18500000',
    condition: 'like_new',
    sellerProfile: { userId: 'seller-user-uuid' },
  },
  conversation: null,
}

const SNAPSHOT_EXAMPLE = {
  id: 'snapshot-uuid-here',
  matchId: 'match-uuid-here',
  modelVersion: 'v1',
  rankPosition: 1,
  candidateSetSize: 5,
  textScore: 0.7695,
  visualScore: null,
  finalScore: 0.7695,
  penaltiesApplied: {},
  demandSnapshot: { title: 'Cần mua laptop sinh viên', budgetMax: 10000000, preferredCondition: 'good', location: 'Quận 10' },
  listingSnapshot: { title: 'MacBook Air M1', price: 18500000, condition: 'like_new', hasImage: true, imageCount: 3 },
  featureVector: { textScore: 0.7695, finalScore: 0.7695, priceRatio: 1.85, conditionMatch: 1, conditionGap: -2, hasImage: 1, hasVision: 1, hasBudget: 1, hasConditionPref: 1 },
  createdAt: '2026-04-11T10:00:00.000Z',
}

@ApiBearerAuth('access-token')
@ApiTags('Matches')
@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get a match with demand and listing details' })
  @ApiResponse({ status: 200, description: 'Match with demandRequest, productListing, and conversation', schema: { example: MATCH_EXAMPLE } })
  @ApiResponse({ status: 404, description: 'Match not found', schema: { example: { statusCode: 404, message: 'Match not found', error: 'Not Found' } } })
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.matchesService.findOne(req.user.id, id)
  }

  @Get(':id/snapshot')
  @ApiOperation({ summary: 'Get AI score snapshot for a match', description: 'Returns the MatchSnapshot saved at creation time: textScore, finalScore, featureVector, penalties, and context snapshots of demand and listing.' })
  @ApiResponse({ status: 200, description: 'MatchSnapshot with full feature vector', schema: { example: SNAPSHOT_EXAMPLE } })
  @ApiResponse({ status: 404, description: 'Snapshot not found (match may predate snapshot feature)' })
  snapshot(@Request() req: any, @Param('id') id: string) {
    return this.matchesService.getSnapshot(req.user.id, id)
  }

  @Get(':id/interactions')
  @ApiOperation({ summary: 'Get all interaction events for a match', description: 'Returns raw interaction events plus the aggregated training label (max action score).' })
  @ApiResponse({
    status: 200,
    description: 'Interactions with aggregated label',
    schema: {
      example: {
        matchId: 'match-uuid-here',
        interactions: [
          { id: 'i1', action: 'messaged', userId: 'buyer-uuid', surface: 'match_list', createdAt: '2026-04-11T10:05:00.000Z' },
          { id: 'i2', action: 'offered', userId: 'buyer-uuid', surface: null, createdAt: '2026-04-11T10:20:00.000Z' },
          { id: 'i3', action: 'ordered', userId: 'buyer-uuid', surface: null, createdAt: '2026-04-11T11:00:00.000Z' },
        ],
        aggregatedLabel: 1.0,
        labelSource: 'ordered',
      },
    },
  })
  interactions(@Request() req: any, @Param('id') id: string) {
    return this.matchesService.getInteractions(req.user.id, id)
  }

  @Post(':id/acknowledge')
  @ApiOperation({ summary: 'Accept a match', description: 'When both buyer and seller acknowledge, match status changes to active and a Conversation is opened automatically.' })
  @ApiResponse({
    status: 201,
    description: 'Acknowledged — returns updated match',
    schema: {
      example: {
        ...MATCH_EXAMPLE,
        buyerAcknowledged: true,
        sellerAcknowledged: false,
        status: 'buyer_confirmed',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Already acknowledged or match not in proposable state' })
  acknowledge(@Request() req: any, @Param('id') id: string) {
    return this.matchesService.acknowledge(req.user.id, id)
  }

  @Post(':id/decline')
  @ApiOperation({ summary: 'Decline a match', description: 'Closes the match with status closed_failed.' })
  @ApiResponse({ status: 201, description: 'Match declined', schema: { example: { ...MATCH_EXAMPLE, status: 'closed_failed' } } })
  decline(@Request() req: any, @Param('id') id: string) {
    return this.matchesService.decline(req.user.id, id)
  }

  @Post(':id/interact')
  @ApiOperation({ summary: 'Log a user interaction event', description: 'Used for LTR training data collection. Auto-logged events: messaged, offered, ordered. Manual events: impressed, detail_viewed, accepted, dismissed.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['action'],
      properties: {
        action:    { type: 'string', enum: ['impressed', 'detail_viewed', 'accepted', 'dismissed', 'messaged', 'offered', 'ordered'] },
        surface:   { type: 'string', enum: ['match_list', 'push_notification', 'home_feed', 'direct'], nullable: true },
        sessionId: { type: 'string', nullable: true },
        metadata:  { type: 'object', nullable: true },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Interaction logged',
    schema: {
      example: {
        id: 'interaction-uuid',
        matchId: 'match-uuid-here',
        userId: 'user-uuid',
        action: 'detail_viewed',
        surface: 'match_list',
        createdAt: '2026-04-11T10:02:00.000Z',
      },
    },
  })
  interact(
    @Request() req: any,
    @Param('id') id: string,
    @Body('action')    action:    string,
    @Body('surface')   surface?:  string,
    @Body('sessionId') sessionId?: string,
    @Body('metadata')  metadata?:  any,
  ) {
    return this.matchesService.logInteraction(req.user.id, id, action, surface, sessionId, metadata)
  }
}
