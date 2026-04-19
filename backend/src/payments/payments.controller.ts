import {
  Controller, Post, Get, Body, Query, Param,
  Req, Res, UseGuards, HttpCode,
} from '@nestjs/common'
import { Response }          from 'express'
import { ConfigService }     from '@nestjs/config'
import { JwtAuthGuard }      from '../auth/guards/jwt-auth.guard'
import { PaymentsService }   from './payments.service'
import { InitiatePaymentDto } from './dto/initiate-payment.dto'

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly config:   ConfigService,
  ) {}

  // Buyer initiates payment (authenticated)
  @UseGuards(JwtAuthGuard)
  @Post('initiate')
  initiate(@Req() req: any, @Body() dto: InitiatePaymentDto) {
    return this.payments.initiate(req.user.id, dto)
  }

  // Get payment by orderId (authenticated)
  @UseGuards(JwtAuthGuard)
  @Get('by-order/:orderId')
  byOrder(@Param('orderId') orderId: string) {
    return this.payments.findByOrder(orderId)
  }

  // MoMo IPN webhook (no auth — called by MoMo servers)
  @Post('momo/ipn')
  @HttpCode(200)
  momoIpn(@Body() body: Record<string, any>) {
    return this.payments.handleMomoIpn(body)
  }

  // VNPay endpoints disabled — will be re-enabled in a future release
  // @Get('vnpay/ipn')
  // vnpayIpn(@Query() query: Record<string, any>) { return this.payments.handleVnpayIpn(query) }

  // @Get('vnpay/return')
  // async vnpayReturn(@Query() query: Record<string, any>, @Res() res: Response) { ... }
}
