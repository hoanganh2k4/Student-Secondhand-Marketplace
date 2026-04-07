import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common'
import { JwtAuthGuard }  from '../auth/guards/jwt-auth.guard'
import { MatchesService } from './matches.service'

@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.matchesService.findOne(req.user.id, id)
  }

  @Post(':id/acknowledge')
  acknowledge(@Request() req: any, @Param('id') id: string) {
    return this.matchesService.acknowledge(req.user.id, id)
  }

  @Post(':id/decline')
  decline(@Request() req: any, @Param('id') id: string) {
    return this.matchesService.decline(req.user.id, id)
  }
}
