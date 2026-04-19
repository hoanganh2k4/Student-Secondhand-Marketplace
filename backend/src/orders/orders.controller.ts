import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common'
import { JwtAuthGuard }  from '../auth/guards/jwt-auth.guard'
import { OrdersService } from './orders.service'
import { CancelOrderDto, DisputeOrderDto, ReviewOrderDto } from './dto/orders.dto'

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
  status: 'in_progress',
  buyerConfirmedComplete: false,
  sellerConfirmedComplete: false,
  completedAt: null,
  createdAt: '2026-04-11T10:05:00.000Z',
  buyer: { id: 'buyer-uuid', name: 'Nguyễn Huy Hoàng Anh', email: 'buyer@hcmut.edu.vn' },
  seller: { id: 'seller-uuid', name: 'Trần Văn B', email: 'seller@hcmut.edu.vn' },
  match: {
    productListing: { title: 'MacBook Air M1', condition: 'like_new' },
    demandRequest: { title: 'Cần mua laptop sinh viên' },
  },
  ratingReviews: [],
  dispute: null,
}

@ApiBearerAuth('access-token')
@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List all orders for current user', description: 'Returns orders where user is buyer or seller. Use buyerUserId/sellerUserId to filter on frontend.' })
  @ApiResponse({
    status: 200,
    description: 'Array of orders',
    schema: {
      example: [
        ORDER_EXAMPLE,
        { ...ORDER_EXAMPLE, id: 'order-2-uuid', status: 'completed', buyerConfirmedComplete: true, sellerConfirmedComplete: true },
      ],
    },
  })
  list(@Request() req: any) {
    return this.ordersService.list(req.user.id)
  }

  @Get('wallet')
  @ApiOperation({ summary: 'Get wallet balance and transaction history' })
  wallet(@Request() req: any) {
    return this.ordersService.getWallet(req.user.id)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single order with full details' })
  @ApiResponse({ status: 200, description: 'Order with buyer/seller, match, offer, reviews, dispute', schema: { example: ORDER_EXAMPLE } })
  @ApiResponse({ status: 404, description: 'Order not found', schema: { example: { statusCode: 404, message: 'Order not found', error: 'Not Found' } } })
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.ordersService.findOne(req.user.id, id)
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Confirm order completion', description: 'Both buyer and seller must confirm. When both confirm, status → completed.' })
  @ApiResponse({
    status: 201,
    description: 'Confirmed — returns updated order',
    schema: {
      example: {
        ...ORDER_EXAMPLE,
        buyerConfirmedComplete: true,
        sellerConfirmedComplete: false,
        status: 'in_progress',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Order not in confirmable status', schema: { example: { statusCode: 400, message: 'Order is not in progress', error: 'Bad Request' } } })
  confirm(@Request() req: any, @Param('id') id: string) {
    return this.ordersService.confirm(req.user.id, id)
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel an order', description: 'Only possible before completion. Requires a cancellation reason.' })
  @ApiResponse({ status: 201, description: 'Order cancelled', schema: { example: { ...ORDER_EXAMPLE, status: 'cancelled', cancellationReason: 'Người mua không đến điểm hẹn.', cancelledAt: '2026-04-12T08:00:00.000Z' } } })
  @ApiResponse({ status: 400, description: 'Order already completed or disputed' })
  cancel(@Request() req: any, @Param('id') id: string, @Body() dto: CancelOrderDto) {
    return this.ordersService.cancel(req.user.id, id, dto)
  }

  @Post(':id/dispute')
  @ApiOperation({ summary: 'Open a dispute', description: 'Creates a Dispute record. Admin will review. Available within 48h of completion.' })
  @ApiResponse({
    status: 201,
    description: 'Dispute created',
    schema: {
      example: {
        id: 'dispute-uuid',
        orderId: 'order-uuid-here',
        filedByUserId: 'buyer-uuid',
        disputeType: 'item_not_as_described',
        description: 'Máy không đúng như mô tả, pin chỉ còn 60%.',
        status: 'opened',
        openedAt: '2026-04-12T08:00:00.000Z',
        resolution: null,
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Order not disputable or window expired' })
  dispute(@Request() req: any, @Param('id') id: string, @Body() dto: DisputeOrderDto) {
    return this.ordersService.dispute(req.user.id, id, dto)
  }

  @Post(':id/review')
  @ApiOperation({ summary: 'Leave a review for the other party', description: 'Buyer reviews seller and vice versa. One review per role per order. Only after completion.' })
  @ApiResponse({
    status: 201,
    description: 'Review submitted',
    schema: {
      example: {
        id: 'review-uuid',
        orderId: 'order-uuid-here',
        reviewerUserId: 'buyer-uuid',
        reviewedUserId: 'seller-uuid',
        roleOfReviewer: 'buyer',
        rating: 5,
        comment: 'Người bán uy tín, máy đúng như mô tả.',
        createdAt: '2026-04-13T09:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Already reviewed or order not completed' })
  review(@Request() req: any, @Param('id') id: string, @Body() dto: ReviewOrderDto) {
    return this.ordersService.review(req.user.id, id, dto)
  }
}
