import { ApiTags } from '@nestjs/swagger'
import { ApiBearerAuth } from '@nestjs/swagger'
import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common'
import { JwtAuthGuard }  from '../auth/guards/jwt-auth.guard'
import { OrdersService } from './orders.service'
import { CancelOrderDto, DisputeOrderDto, ReviewOrderDto } from './dto/orders.dto'

@ApiBearerAuth('access-token')
@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  list(@Request() req: any) {
    return this.ordersService.list(req.user.id)
  }

  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.ordersService.findOne(req.user.id, id)
  }

  @Post(':id/confirm')
  confirm(@Request() req: any, @Param('id') id: string) {
    return this.ordersService.confirm(req.user.id, id)
  }

  @Post(':id/cancel')
  cancel(@Request() req: any, @Param('id') id: string, @Body() dto: CancelOrderDto) {
    return this.ordersService.cancel(req.user.id, id, dto)
  }

  @Post(':id/dispute')
  dispute(@Request() req: any, @Param('id') id: string, @Body() dto: DisputeOrderDto) {
    return this.ordersService.dispute(req.user.id, id, dto)
  }

  @Post(':id/review')
  review(@Request() req: any, @Param('id') id: string, @Body() dto: ReviewOrderDto) {
    return this.ordersService.review(req.user.id, id, dto)
  }
}
