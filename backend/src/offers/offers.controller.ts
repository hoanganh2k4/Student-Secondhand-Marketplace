import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { Controller, Get, Post, Delete, Param, Body, UseGuards, Request } from '@nestjs/common'
import { JwtAuthGuard }  from '../auth/guards/jwt-auth.guard'
import { OffersService } from './offers.service'
import { CreateOfferDto, CounterOfferDto } from './dto/offers.dto'

const OFFER_EXAMPLE = {
  id: 'offer-uuid-here',
  conversationId: 'conv-uuid-here',
  createdByUserId: 'user-uuid-here',
  matchId: 'match-uuid-here',
  quantity: 1,
  proposedPrice: '17500000',
  totalPrice: '17500000',
  fulfillmentMethod: 'pickup',
  meetupLocation: 'Sân BK cơ sở 2, 268 Lý Thường Kiệt',
  meetupTime: '2026-04-20T15:00:00.000Z',
  termsNotes: 'Bao gồm sạc và hộp máy.',
  status: 'pending',
  expiresAt: '2026-04-14T10:00:00.000Z',
  createdAt: '2026-04-11T10:00:00.000Z',
}

const ORDER_EXAMPLE = {
  id: 'order-uuid-here',
  offerId: 'offer-uuid-here',
  matchId: 'match-uuid-here',
  buyerUserId: 'buyer-uuid',
  sellerUserId: 'seller-uuid',
  quantity: 1,
  finalPrice: '17500000',
  fulfillmentMethod: 'pickup',
  meetupDetails: 'Sân BK cơ sở 2, 268 Lý Thường Kiệt — 20/04 15:00',
  status: 'created',
  buyerConfirmedComplete: false,
  sellerConfirmedComplete: false,
  createdAt: '2026-04-11T10:05:00.000Z',
}

@ApiBearerAuth('access-token')
@ApiTags('Offers')
@Controller()
@UseGuards(JwtAuthGuard)
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Post('matches/:matchId/offers')
  @ApiOperation({ summary: 'Create an offer for a match', description: 'Creates an offer in pending status. The other party can accept, reject, or counter.' })
  @ApiResponse({ status: 201, description: 'Offer created', schema: { example: OFFER_EXAMPLE } })
  @ApiResponse({ status: 400, description: 'Validation error or match not active', schema: { example: { statusCode: 400, message: 'Match is not in active status', error: 'Bad Request' } } })
  @ApiResponse({ status: 404, description: 'Match not found' })
  create(
    @Request() req: any,
    @Param('matchId') matchId: string,
    @Body() dto: CreateOfferDto,
  ) {
    return this.offersService.create(req.user.id, matchId, dto)
  }

  @Get('offers/:id')
  @ApiOperation({ summary: 'Get a single offer by ID' })
  @ApiResponse({ status: 200, description: 'Offer with conversation and match', schema: { example: OFFER_EXAMPLE } })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.offersService.findOne(req.user.id, id)
  }

  @Post('offers/:id/accept')
  @ApiOperation({ summary: 'Accept an offer', description: 'Accepting creates an Order automatically. Offer status → accepted.' })
  @ApiResponse({
    status: 201,
    description: 'Offer accepted — Order created',
    schema: { example: { offer: { ...OFFER_EXAMPLE, status: 'accepted' }, order: ORDER_EXAMPLE } },
  })
  @ApiResponse({ status: 400, description: 'Offer already accepted, rejected, or expired', schema: { example: { statusCode: 400, message: 'Offer is not in pending status', error: 'Bad Request' } } })
  accept(@Request() req: any, @Param('id') id: string) {
    return this.offersService.accept(req.user.id, id)
  }

  @Post('offers/:id/reject')
  @ApiOperation({ summary: 'Reject an offer' })
  @ApiResponse({ status: 201, description: 'Offer rejected', schema: { example: { ...OFFER_EXAMPLE, status: 'rejected' } } })
  reject(@Request() req: any, @Param('id') id: string) {
    return this.offersService.reject(req.user.id, id)
  }

  @Post('offers/:id/counter')
  @ApiOperation({ summary: 'Submit a counter-offer', description: 'Creates a new offer linked to the original via parentOfferId. Original offer → countered.' })
  @ApiResponse({
    status: 201,
    description: 'Counter-offer created',
    schema: { example: { ...OFFER_EXAMPLE, id: 'counter-offer-uuid', proposedPrice: '16800000', parentOfferId: 'offer-uuid-here', status: 'pending' } },
  })
  counter(@Request() req: any, @Param('id') id: string, @Body() dto: CounterOfferDto) {
    return this.offersService.counter(req.user.id, id, dto)
  }

  @Delete('offers/:id')
  @ApiOperation({ summary: 'Cancel / withdraw an offer (draft or pending only)' })
  @ApiResponse({ status: 200, description: 'Offer cancelled', schema: { example: { ...OFFER_EXAMPLE, status: 'cancelled' } } })
  cancel(@Request() req: any, @Param('id') id: string) {
    return this.offersService.cancel(req.user.id, id)
  }
}
