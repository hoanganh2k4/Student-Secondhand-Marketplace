import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { ConfigService }         from '@nestjs/config'
import { PrismaService }         from '../prisma/prisma.service'
import { ConversationsService }  from '../conversations/conversations.service'
import { MomoService }           from './momo.service'
import { VnpayService }          from './vnpay.service'
import { InitiatePaymentDto, PaymentGatewayDto } from './dto/initiate-payment.dto'
import { v4 as uuid }            from 'uuid'

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name)

  constructor(
    private readonly prisma:         PrismaService,
    private readonly config:         ConfigService,
    private readonly conversations:  ConversationsService,
    private readonly momo:           MomoService,
    private readonly vnpay:          VnpayService,
  ) {}

  private get ngrokUrl(): string {
    return this.config.get<string>('NGROK_URL', 'http://localhost:4000')
  }

  private get frontendUrl(): string {
    return this.config.get<string>('FRONTEND_URL', 'http://localhost:3000')
  }

  // ─── FIND BY ORDER ────────────────────────────────────────────────────────

  async findByOrder(orderId: string) {
    return this.prisma.payment.findUnique({ where: { orderId } })
  }

  // ─── INITIATE ─────────────────────────────────────────────────────────────

  async initiate(userId: string, dto: InitiatePaymentDto) {
    const { orderRequestId, gateway } = dto

    const orderRequest = await this.prisma.orderRequest.findUnique({
      where:   { id: orderRequestId },
      include: { conversation: true },
    })

    if (!orderRequest) throw new NotFoundException('Order request not found.')
    if (orderRequest.conversation.buyerUserId !== userId) {
      throw new ForbiddenException('Only the buyer can initiate payment.')
    }
    if (orderRequest.status !== 'awaiting_payment') {
      throw new UnprocessableEntityException('Order request is not awaiting payment.')
    }

    const existing = await this.prisma.payment.findUnique({ where: { orderRequestId } })
    if (existing && existing.status === 'success') {
      throw new UnprocessableEntityException('Payment already completed.')
    }

    const amount         = Math.round(Number(orderRequest.price) * (orderRequest.quantity ?? 1))
    // Always generate a new gatewayOrderId on retry — gateways reject duplicate orderIds
    const gatewayOrderId = `MKT-${uuid().replace(/-/g, '').slice(0, 20)}`
    const requestId      = uuid()

    let paymentUrl: string

    if (gateway === PaymentGatewayDto.MOMO) {
      const ipnUrl      = `${this.ngrokUrl}/api/payments/momo/ipn`
      const redirectUrl = `${this.frontendUrl}/payment/result?gateway=momo`

      const result = await this.momo.createPayment({
        orderId:     gatewayOrderId,
        requestId,
        amount,
        orderInfo:   `Thanh toan don hang ${gatewayOrderId}`,
        redirectUrl,
        ipnUrl,
      })
      paymentUrl = result.payUrl

    } else {
      // VNPay temporarily disabled — will be re-enabled in a future release
      throw new UnprocessableEntityException('VNPay payment is currently unavailable. Please use MoMo.')
      // const now        = new Date()
      // const createDate = now.toISOString().replace(/[-T:.Z]/g, '').slice(0, 14)
      // const returnUrl  = `${this.ngrokUrl}/api/payments/vnpay/return`
      // paymentUrl = this.vnpay.createPaymentUrl({
      //   orderId:    gatewayOrderId,
      //   amount,
      //   orderInfo:  `Thanh toan don hang ${gatewayOrderId}`,
      //   returnUrl,
      //   ipAddr:     '127.0.0.1',
      //   createDate,
      // })
    }

    // Upsert Payment record
    const payment = await this.prisma.payment.upsert({
      where:  { orderRequestId },
      create: {
        orderRequestId,
        gateway:       gateway as any,
        amount,
        gatewayOrderId,
        paymentUrl,
        status:        'pending',
      },
      update: {
        gateway:        gateway as any,
        gatewayOrderId,
        paymentUrl,
        status:         'pending',
      },
    })

    return { paymentUrl: payment.paymentUrl, gatewayOrderId }
  }

  // ─── MOMO IPN ─────────────────────────────────────────────────────────────

  async handleMomoIpn(body: Record<string, any>): Promise<{ message: string }> {
    this.logger.log(`MoMo IPN: orderId=${body.orderId} resultCode=${body.resultCode}`)

    if (!this.momo.verifyIpn(body)) {
      this.logger.warn(`MoMo IPN signature invalid — orderId=${body.orderId} partnerCode=${body.partnerCode}`)
      return { message: 'invalid signature' }
    }

    const payment = await this.prisma.payment.findUnique({
      where:   { gatewayOrderId: body.orderId },
      include: { orderRequest: { include: { conversation: true } } },
    })

    this.logger.log(`MoMo IPN payment lookup: ${payment ? `found id=${payment.id} status=${payment.status}` : 'NOT FOUND'}`)

    if (!payment || payment.status === 'success') return { message: 'ok' }

    if (body.resultCode === 0) {
      await this.onPaymentSuccess(payment, String(body.transId), body)
    } else {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data:  { status: 'failed', rawCallback: body },
      })
    }

    return { message: 'ok' }
  }

  // ─── VNPAY IPN (disabled) ─────────────────────────────────────────────────

  // async handleVnpayIpn(query: Record<string, any>): Promise<{ RspCode: string; Message: string }> {
  //   this.logger.log(`VNPay IPN: TxnRef=${query.vnp_TxnRef} ResponseCode=${query.vnp_ResponseCode}`)
  //   if (!this.vnpay.verifyIpn(query)) return { RspCode: '97', Message: 'Invalid signature' }
  //   const payment = await this.prisma.payment.findUnique({
  //     where:   { gatewayOrderId: query.vnp_TxnRef },
  //     include: { orderRequest: { include: { conversation: true } } },
  //   })
  //   if (!payment)                    return { RspCode: '01', Message: 'Order not found' }
  //   if (payment.status === 'success') return { RspCode: '02', Message: 'Already confirmed' }
  //   if (query.vnp_ResponseCode === '00') {
  //     await this.onPaymentSuccess(payment, query.vnp_TransactionNo, query)
  //   } else {
  //     await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'failed', rawCallback: query } })
  //   }
  //   return { RspCode: '00', Message: 'Confirm success' }
  // }

  // ─── VNPAY RETURN (disabled) ──────────────────────────────────────────────

  // async handleVnpayReturn(query: Record<string, any>): Promise<{ success: boolean; orderId?: string }> {
  //   if (!this.vnpay.verifyIpn(query)) return { success: false }
  //   const payment = await this.prisma.payment.findUnique({ where: { gatewayOrderId: query.vnp_TxnRef } })
  //   return { success: query.vnp_ResponseCode === '00', orderId: payment?.orderId ?? undefined }
  // }

  // ─── REFUND ───────────────────────────────────────────────────────────────

  async refund(orderId: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({ where: { orderId } })
    if (!payment || payment.status !== 'success') {
      throw new UnprocessableEntityException('No successful payment to refund.')
    }

    if (payment.gateway === 'momo') {
      await this.momo.refund({
        orderId:   payment.gatewayOrderId,
        requestId: uuid(),
        transId:   payment.gatewayTxId!,
        amount:    payment.amount,
        desc:      `Hoan tien don hang ${orderId}`,
      })
    } else {
      // VNPay refund disabled — will be re-enabled with VNPay integration
      throw new UnprocessableEntityException('VNPay refund is currently unavailable.')
      // const now = new Date()
      // const fmt = (d: Date) => d.toISOString().replace(/[-T:.Z]/g, '').slice(0, 14)
      // const cb  = payment.rawCallback as Record<string, any>
      // await this.vnpay.refund({ orderId: payment.gatewayOrderId, transDate: cb?.vnp_PayDate ?? fmt(payment.paidAt!),
      //   amount: payment.amount, desc: `Hoan tien don hang ${orderId}`, ipAddr: '127.0.0.1',
      //   createDate: fmt(now), transType: '02' })
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data:  { status: 'refunded', refundedAt: new Date() },
    })
  }

  // ─── INTERNAL ─────────────────────────────────────────────────────────────

  private async onPaymentSuccess(
    payment:    any,
    gatewayTxId: string,
    rawCallback: Record<string, any>,
  ) {
    await this.prisma.payment.update({
      where: { id: payment.id },
      data:  { status: 'success', gatewayTxId, rawCallback, paidAt: new Date() },
    })

    const orderRequest = payment.orderRequest
    const conv         = orderRequest.conversation

    // Mark OrderRequest as completed
    await this.prisma.orderRequest.update({
      where: { id: orderRequest.id },
      data:  { status: 'completed' },
    })

    // Finalize the order (creates Order in DB, closes conversation, etc.)
    const updatedRequest = { ...orderRequest, status: 'completed' }
    await this.conversations.finalizeOrder(updatedRequest, conv)

    // Link Payment → Order
    const created = await this.prisma.orderRequest.findUnique({
      where: { id: orderRequest.id },
    })
    if (created?.orderId) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data:  { orderId: created.orderId },
      })

      // Record buyer wallet debit (money sent to escrow)
      await this.prisma.walletTransaction.create({
        data: {
          userId:      conv.buyerUserId,
          orderId:     created.orderId,
          type:        'payment',
          amount:      payment.amount,
          balance:     0,
          description: `Payment for order #${created.orderId.slice(0, 8)}`,
        },
      })
    }
  }
}
