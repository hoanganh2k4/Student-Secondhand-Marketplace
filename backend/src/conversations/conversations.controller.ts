import { Controller, Get, Post, Patch, Param, Body, UseGuards, Request } from '@nestjs/common'
import { JwtAuthGuard }          from '../auth/guards/jwt-auth.guard'
import { ConversationsService }  from './conversations.service'
import {
  SendMessageDto,
  CreateEvidenceRequestDto,
  FulfillEvidenceRequestDto,
  CreateOrderRequestDto,
  SellerInfoDto,
  BuyerInfoDto,
} from './dto/conversations.dto'

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  list(@Request() req: any) {
    return this.conversationsService.list(req.user.id)
  }

  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.conversationsService.findOne(req.user.id, id)
  }

  @Post(':id/messages')
  sendMessage(@Request() req: any, @Param('id') id: string, @Body() dto: SendMessageDto) {
    return this.conversationsService.sendMessage(req.user.id, id, dto)
  }

  @Post(':id/advance-stage')
  advanceStage(@Request() req: any, @Param('id') id: string) {
    return this.conversationsService.advanceStage(req.user.id, id)
  }

  // ─── Order requests ───────────────────────────────────────────────────────

  @Post(':id/order-requests')
  createOrderRequest(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: CreateOrderRequestDto,
  ) {
    return this.conversationsService.createOrderRequest(req.user.id, id, dto)
  }

  @Post('order-requests/:requestId/accept')
  acceptOrderRequest(@Request() req: any, @Param('requestId') requestId: string) {
    return this.conversationsService.respondToOrderRequest(req.user.id, requestId, 'accept')
  }

  @Post('order-requests/:requestId/reject')
  rejectOrderRequest(@Request() req: any, @Param('requestId') requestId: string) {
    return this.conversationsService.respondToOrderRequest(req.user.id, requestId, 'reject')
  }

  @Patch('order-requests/:requestId/seller-info')
  fillSellerInfo(
    @Request() req: any,
    @Param('requestId') requestId: string,
    @Body() dto: SellerInfoDto,
  ) {
    return this.conversationsService.fillSellerInfo(req.user.id, requestId, dto)
  }

  @Patch('order-requests/:requestId/buyer-info')
  fillBuyerInfo(
    @Request() req: any,
    @Param('requestId') requestId: string,
    @Body() dto: BuyerInfoDto,
  ) {
    return this.conversationsService.fillBuyerInfo(req.user.id, requestId, dto)
  }

  // ─── Evidence requests ────────────────────────────────────────────────────

  @Post(':id/evidence-requests')
  createEvidenceRequest(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: CreateEvidenceRequestDto,
  ) {
    return this.conversationsService.createEvidenceRequest(req.user.id, id, dto)
  }

  @Patch(':id/evidence-requests/:erId')
  fulfillEvidenceRequest(
    @Request() req: any,
    @Param('id') id: string,
    @Param('erId') erId: string,
    @Body() dto: FulfillEvidenceRequestDto,
  ) {
    return this.conversationsService.fulfillEvidenceRequest(req.user.id, id, erId, dto)
  }
}
