import { Controller, Get, Post, Delete, Param, Body, UseGuards, Request } from '@nestjs/common'
import { JwtAuthGuard }  from '../auth/guards/jwt-auth.guard'
import { OffersService } from './offers.service'
import { CreateOfferDto, CounterOfferDto } from './dto/offers.dto'

@Controller()
@UseGuards(JwtAuthGuard)
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  // POST /matches/:matchId/offers
  @Post('matches/:matchId/offers')
  create(
    @Request() req: any,
    @Param('matchId') matchId: string,
    @Body() dto: CreateOfferDto,
  ) {
    return this.offersService.create(req.user.id, matchId, dto)
  }

  @Get('offers/:id')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.offersService.findOne(req.user.id, id)
  }

  @Post('offers/:id/accept')
  accept(@Request() req: any, @Param('id') id: string) {
    return this.offersService.accept(req.user.id, id)
  }

  @Post('offers/:id/reject')
  reject(@Request() req: any, @Param('id') id: string) {
    return this.offersService.reject(req.user.id, id)
  }

  @Post('offers/:id/counter')
  counter(@Request() req: any, @Param('id') id: string, @Body() dto: CounterOfferDto) {
    return this.offersService.counter(req.user.id, id, dto)
  }

  @Delete('offers/:id')
  cancel(@Request() req: any, @Param('id') id: string) {
    return this.offersService.cancel(req.user.id, id)
  }
}
