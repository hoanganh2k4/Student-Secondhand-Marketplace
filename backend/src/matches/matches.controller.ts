import { ApiTags, ApiBearerAuth, ApiBody, ApiQuery } from '@nestjs/swagger'
import { Controller, Get, Post, Body, Param, Query, UseGuards, Request, DefaultValuePipe, ParseIntPipe } from '@nestjs/common'
import { JwtAuthGuard }  from '../auth/guards/jwt-auth.guard'
import { MatchesService } from './matches.service'

@ApiBearerAuth('access-token')
@ApiTags('Matches')
@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.matchesService.findOne(req.user.id, id)
  }

  /** GET /matches/:id/snapshot — score breakdown + features for a match (LTR training data) */
  @Get(':id/snapshot')
  snapshot(@Request() req: any, @Param('id') id: string) {
    return this.matchesService.getSnapshot(req.user.id, id)
  }

  /** GET /matches/:id/interactions — all user interaction events logged for this match */
  @Get(':id/interactions')
  interactions(@Request() req: any, @Param('id') id: string) {
    return this.matchesService.getInteractions(req.user.id, id)
  }

  @Post(':id/acknowledge')
  acknowledge(@Request() req: any, @Param('id') id: string) {
    return this.matchesService.acknowledge(req.user.id, id)
  }

  @Post(':id/decline')
  decline(@Request() req: any, @Param('id') id: string) {
    return this.matchesService.decline(req.user.id, id)
  }

  /**
   * POST /matches/:id/interact
   * Log a user interaction event for a match (for LTR training data collection).
   * action: impressed | detail_viewed | accepted | dismissed | messaged | offered | ordered
   */
  @Post(':id/interact')
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
