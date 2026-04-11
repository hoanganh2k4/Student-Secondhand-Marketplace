import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger'
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

const CONV_EXAMPLE = {
  id: 'conv-uuid-here',
  matchId: 'match-uuid-here',
  buyerUserId: 'buyer-uuid',
  sellerUserId: 'seller-uuid',
  stage: 'verification',
  status: 'active',
  lastActivityAt: '2026-04-11T10:30:00.000Z',
  autoCloseAt: '2026-04-25T10:00:00.000Z',
  buyer: { id: 'buyer-uuid', name: 'Nguyễn Huy Hoàng Anh' },
  seller: { id: 'seller-uuid', name: 'Trần Văn B' },
  match: { productListing: { title: 'MacBook Air M1' } },
}

const MESSAGE_EXAMPLE = {
  id: 'msg-uuid-here',
  conversationId: 'conv-uuid-here',
  senderUserId: 'buyer-uuid',
  messageType: 'text',
  body: 'Cho mình hỏi thêm về tình trạng pin nhé?',
  mediaUrl: null,
  isSystemGenerated: false,
  createdAt: '2026-04-11T10:05:00.000Z',
}

const ORDER_REQUEST_EXAMPLE = {
  id: 'order-req-uuid',
  conversationId: 'conv-uuid-here',
  initiatedByUserId: 'buyer-uuid',
  status: 'pending',
  price: null,
  quantity: 1,
  fulfillmentMethod: null,
  buyerPhone: null,
  buyerEmail: null,
  deliveryAddress: null,
  orderId: null,
  createdAt: '2026-04-11T10:20:00.000Z',
}

@ApiBearerAuth('access-token')
@ApiTags('Conversations')
@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  @ApiOperation({ summary: 'List all conversations for current user', description: 'Ordered by lastActivityAt descending.' })
  @ApiResponse({
    status: 200,
    description: 'Array of conversations',
    schema: {
      example: [
        { ...CONV_EXAMPLE, messages: [MESSAGE_EXAMPLE] },
        { ...CONV_EXAMPLE, id: 'conv-2-uuid', stage: 'negotiation', lastActivityAt: '2026-04-10T15:00:00.000Z' },
      ],
    },
  })
  list(@Request() req: any) {
    return this.conversationsService.list(req.user.id)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a conversation with all messages' })
  @ApiResponse({
    status: 200,
    description: 'Conversation with messages, evidenceRequests, orderRequests',
    schema: {
      example: {
        ...CONV_EXAMPLE,
        messages: [
          MESSAGE_EXAMPLE,
          { ...MESSAGE_EXAMPLE, id: 'msg-2', senderUserId: 'seller-uuid', body: 'Pin còn 98%, máy rất đẹp bạn ơi.' },
        ],
        evidenceRequests: [],
        orderRequests: [],
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.conversationsService.findOne(req.user.id, id)
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Send a message', description: 'For image/video: upload via POST /api/uploads first, use returned key as mediaKey.' })
  @ApiResponse({ status: 201, description: 'Message sent — emitted via WebSocket', schema: { example: MESSAGE_EXAMPLE } })
  @ApiResponse({ status: 400, description: 'Conversation closed', schema: { example: { statusCode: 400, message: 'Conversation is closed', error: 'Bad Request' } } })
  sendMessage(@Request() req: any, @Param('id') id: string, @Body() dto: SendMessageDto) {
    return this.conversationsService.sendMessage(req.user.id, id, dto)
  }

  @Post(':id/advance-stage')
  @ApiOperation({ summary: 'Advance conversation stage', description: 'verification → clarification → negotiation → closed. Only buyer can advance.' })
  @ApiResponse({
    status: 201,
    description: 'Stage advanced',
    schema: { example: { ...CONV_EXAMPLE, stage: 'clarification', stageEnteredAt: '2026-04-11T10:15:00.000Z' } },
  })
  advanceStage(@Request() req: any, @Param('id') id: string) {
    return this.conversationsService.advanceStage(req.user.id, id)
  }

  // ─── Order requests ───────────────────────────────────────────────────────

  @Post(':id/order-requests')
  @ApiOperation({ summary: 'Initiate an order request', description: 'Buyer initiates. A system message __order_request:<id>__ is posted so the UI renders OrderRequestCard.' })
  @ApiResponse({ status: 201, description: 'OrderRequest created', schema: { example: ORDER_REQUEST_EXAMPLE } })
  createOrderRequest(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: CreateOrderRequestDto,
  ) {
    return this.conversationsService.createOrderRequest(req.user.id, id, dto)
  }

  @Post('order-requests/:requestId/accept')
  @ApiOperation({ summary: 'Accept an order request (seller)' })
  @ApiResponse({ status: 201, description: 'Order request accepted', schema: { example: { ...ORDER_REQUEST_EXAMPLE, status: 'accepted' } } })
  acceptOrderRequest(@Request() req: any, @Param('requestId') requestId: string) {
    return this.conversationsService.respondToOrderRequest(req.user.id, requestId, 'accept')
  }

  @Post('order-requests/:requestId/reject')
  @ApiOperation({ summary: 'Reject an order request (seller)' })
  @ApiResponse({ status: 201, description: 'Order request rejected', schema: { example: { ...ORDER_REQUEST_EXAMPLE, status: 'rejected' } } })
  rejectOrderRequest(@Request() req: any, @Param('requestId') requestId: string) {
    return this.conversationsService.respondToOrderRequest(req.user.id, requestId, 'reject')
  }

  @Patch('order-requests/:requestId/seller-info')
  @ApiOperation({ summary: 'Seller fills price and quantity' })
  @ApiResponse({
    status: 200,
    description: 'Seller info saved',
    schema: { example: { ...ORDER_REQUEST_EXAMPLE, status: 'seller_filled', price: '17500000', quantity: 1 } },
  })
  fillSellerInfo(
    @Request() req: any,
    @Param('requestId') requestId: string,
    @Body() dto: SellerInfoDto,
  ) {
    return this.conversationsService.fillSellerInfo(req.user.id, requestId, dto)
  }

  @Patch('order-requests/:requestId/buyer-info')
  @ApiOperation({ summary: 'Buyer fills contact + fulfillment info', description: 'When both seller-info and buyer-info are filled, Order is created automatically.' })
  @ApiResponse({
    status: 200,
    description: 'Buyer info saved — Order may be created',
    schema: {
      example: {
        orderRequest: { ...ORDER_REQUEST_EXAMPLE, status: 'completed', buyerPhone: '0901234567', buyerEmail: 'hoanganh@hcmut.edu.vn', fulfillmentMethod: 'pickup' },
        order: { id: 'order-uuid', status: 'created', finalPrice: '17500000', buyerUserId: 'buyer-uuid', sellerUserId: 'seller-uuid' },
      },
    },
  })
  fillBuyerInfo(
    @Request() req: any,
    @Param('requestId') requestId: string,
    @Body() dto: BuyerInfoDto,
  ) {
    return this.conversationsService.fillBuyerInfo(req.user.id, requestId, dto)
  }

  // ─── Evidence requests ────────────────────────────────────────────────────

  @Post(':id/evidence-requests')
  @ApiOperation({ summary: 'Request additional evidence from the other party' })
  @ApiResponse({
    status: 201,
    description: 'Evidence request created',
    schema: {
      example: {
        id: 'evidence-req-uuid',
        conversationId: 'conv-uuid-here',
        requesterUserId: 'buyer-uuid',
        requestType: 'additional_photo',
        description: 'Vui lòng chụp thêm ảnh màn hình battery health.',
        status: 'pending',
        dueAt: '2026-04-18T23:59:00.000Z',
      },
    },
  })
  createEvidenceRequest(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: CreateEvidenceRequestDto,
  ) {
    return this.conversationsService.createEvidenceRequest(req.user.id, id, dto)
  }

  @Patch(':id/evidence-requests/:erId')
  @ApiOperation({ summary: 'Fulfill or reject an evidence request' })
  @ApiResponse({
    status: 200,
    description: 'Evidence request updated',
    schema: { example: { id: 'evidence-req-uuid', status: 'fulfilled', fulfilledAt: '2026-04-13T09:00:00.000Z' } },
  })
  fulfillEvidenceRequest(
    @Request() req: any,
    @Param('id') id: string,
    @Param('erId') erId: string,
    @Body() dto: FulfillEvidenceRequestDto,
  ) {
    return this.conversationsService.fulfillEvidenceRequest(req.user.id, id, erId, dto)
  }
}
