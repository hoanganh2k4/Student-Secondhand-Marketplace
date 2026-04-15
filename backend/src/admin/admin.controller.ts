import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger'
import { Controller, Get, Patch, Param, Body, Query, UseGuards, Request, DefaultValuePipe, ParseIntPipe } from '@nestjs/common'
import { JwtAuthGuard }  from '../auth/guards/jwt-auth.guard'
import { AdminGuard }    from './admin.guard'
import { AdminService }  from './admin.service'
import { ResolveDisputeDto, SuspendUserDto } from './dto/admin.dto'

@ApiBearerAuth('access-token')
@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('disputes')
  @ApiOperation({ summary: 'List all disputes', description: 'Admin only. Returns all disputes with order and filer info.' })
  @ApiQuery({ name: 'status', required: false, enum: ['opened', 'under_review', 'resolved', 'closed'] })
  @ApiResponse({
    status: 200,
    description: 'Array of disputes',
    schema: {
      example: [{
        id: 'dispute-uuid',
        orderId: 'order-uuid',
        disputeType: 'item_not_as_described',
        description: 'Máy không đúng như mô tả, pin chỉ còn 60%.',
        status: 'opened',
        openedAt: '2026-04-12T08:00:00.000Z',
        resolution: null,
        resolutionNotes: null,
        order: { id: 'order-uuid', finalPrice: '17500000' },
        filedBy: { id: 'buyer-uuid', name: 'Nguyễn Huy Hoàng Anh', email: 'buyer@hcmut.edu.vn' },
      }],
    },
  })
  listDisputes() {
    return this.adminService.listDisputes()
  }

  @Patch('disputes/:id/resolve')
  @ApiOperation({ summary: 'Resolve a dispute', description: 'Admin only. Sets resolution and marks dispute as resolved.' })
  @ApiResponse({
    status: 200,
    description: 'Dispute resolved',
    schema: {
      example: {
        id: 'dispute-uuid',
        status: 'resolved',
        resolution: 'resolved_for_buyer',
        resolutionNotes: 'Người mua đã cung cấp đủ bằng chứng. Hoàn tiền.',
        resolvedAt: '2026-04-13T09:00:00.000Z',
        assignedAdminId: 'admin-uuid',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Dispute not found' })
  resolveDispute(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.adminService.resolveDispute(req.user.id, id, dto)
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users', description: 'Admin only. Filter by status.' })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'suspended', 'banned'] })
  @ApiResponse({
    status: 200,
    description: 'Array of users',
    schema: {
      example: [
        { id: 'user-uuid-1', name: 'Nguyễn Huy Hoàng Anh', email: 'buyer@hcmut.edu.vn', status: 'active', createdAt: '2026-01-15T08:00:00.000Z' },
        { id: 'user-uuid-2', name: 'Trần Văn B', email: 'seller@hcmut.edu.vn', status: 'suspended', createdAt: '2026-02-01T09:00:00.000Z' },
      ],
    },
  })
  listUsers(@Query('status') status?: string) {
    return this.adminService.listUsers(status)
  }

  @Patch('users/:id/suspend')
  @ApiOperation({ summary: 'Suspend a user', description: 'Admin only. Sets user status to suspended.' })
  @ApiResponse({
    status: 200,
    description: 'User suspended',
    schema: { example: { id: 'user-uuid', name: 'Trần Văn B', status: 'suspended' } },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  suspendUser(@Param('id') id: string, @Body() dto: SuspendUserDto) {
    return this.adminService.suspendUser(id, dto)
  }

  @Patch('users/:id/ban')
  @ApiOperation({ summary: 'Ban a user permanently', description: 'Admin only. Sets user status to banned.' })
  @ApiResponse({
    status: 200,
    description: 'User banned',
    schema: { example: { id: 'user-uuid', name: 'Trần Văn B', status: 'banned' } },
  })
  banUser(@Param('id') id: string) {
    return this.adminService.banUser(id)
  }

  @Patch('users/:id/reinstate')
  @ApiOperation({ summary: 'Reinstate a suspended or banned user', description: 'Admin only. Sets user status back to active.' })
  @ApiResponse({
    status: 200,
    description: 'User reinstated',
    schema: { example: { id: 'user-uuid', name: 'Trần Văn B', status: 'active' } },
  })
  reinstateUser(@Param('id') id: string) {
    return this.adminService.reinstateUser(id)
  }

  // ─── LISTINGS ─────────────────────────────────────────────────────────────

  @Get('listings')
  @ApiOperation({ summary: 'List all listings', description: 'Admin only. Returns all listings with filtering and pagination.' })
  @ApiQuery({ name: 'status', required: false, description: 'draft | active | matched | in_conversation | partially_sold | sold | expired | removed' })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'condition', required: false, description: 'poor | fair | good | very_good | like_new' })
  @ApiQuery({ name: 'search', required: false, description: 'Title or seller email' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['createdAt', 'priceExpectation', 'proofCompletenessScore'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  listListings(
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
    @Query('condition') condition?: string,
    @Query('search') search?: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number = 0,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.adminService.listListings({ status, categoryId, condition, search, limit, offset, sortBy, sortOrder });
  }

  @Get('listings/:id')
  @ApiOperation({ summary: 'Get listing details', description: 'Admin only. Returns listing details including proof assets and matches.' })
  @ApiParam({ name: 'id', description: 'Listing ID' })
  getListing(@Param('id') id: string) {
    return this.adminService.getListing(id);
  }

  @Patch('listings/:id/remove')
  @ApiOperation({ summary: 'Remove a listing (admin action)', description: 'Admin only. Sets listing status to removed.' })
  @ApiResponse({
    status: 200,
    description: 'Listing removed',
    schema: { example: { id: 'listing-uuid', title: 'MacBook Air M1', status: 'removed' } },
  })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  removeListing(@Param('id') id: string) {
    return this.adminService.removeListing(id);
  }

  // ─── DEMANDS ──────────────────────────────────────────────────────────────

  @Get('demands')
  @ApiOperation({ summary: 'List all demands', description: 'Admin only. Returns all demands with filtering and pagination.' })
  @ApiQuery({ name: 'status', required: false, description: 'draft | active | waiting | matched | in_conversation | in_negotiation | fulfilled | expired | cancelled' })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'search', required: false, description: 'Title or buyer email' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['createdAt', 'expiresAt'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
listDemands(
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number = 0,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.adminService.listDemands({ status, categoryId, search, limit, offset, sortBy, sortOrder })
  }

  @Get('demands/:id')
  @ApiOperation({ summary: 'Get demand details', description: 'Admin only. Returns demand details including buyer info and AI matches.' })
  @ApiParam({ name: 'id', description: 'Demand ID' })
  getDemand(@Param('id') id: string) {
    return this.adminService.getDemand(id)
  }

  // ─── ORDERS ───────────────────────────────────────────────────────────────

  @Get('orders')
  @ApiOperation({ summary: 'List all orders', description: 'Admin only. Returns all orders with filtering and pagination.' })
  @ApiQuery({ name: 'status', required: false, description: 'created | confirmed | in_progress | completed | cancelled | disputed' })
  @ApiQuery({ name: 'fulfillmentMethod', required: false, description: 'pickup | delivery | flexible' })
  @ApiQuery({ name: 'search', required: false, description: 'Email buyer/seller or listing title' })
  @ApiQuery({ name: 'fromDate', required: false, description: 'ISO Date string (e.g. 2026-04-01T00:00:00.000Z)' })
  @ApiQuery({ name: 'toDate', required: false, description: 'ISO Date string (e.g. 2026-04-30T23:59:59.999Z)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['createdAt', 'finalPrice', 'completedAt'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  listOrders(
    @Query('status') status?: string,
    @Query('fulfillmentMethod') fulfillmentMethod?: string,
    @Query('search') search?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number = 0,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.adminService.listOrders({ 
      status, 
      fulfillmentMethod, 
      search, 
      fromDate, 
      toDate, 
      limit, 
      offset, 
      sortBy, 
      sortOrder 
    });
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Get order details', description: 'Admin only. Returns order details including match, offer, dispute, and reviews.' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  getOrder(@Param('id') id: string) {
    return this.adminService.getOrder(id);
  }

  // ─── STATS ────────────────────────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Get marketplace statistics', description: 'Admin only. Returns overall stats for demands, listings, orders, and matches.' })
  @ApiResponse({
    status: 200,
    description: 'Marketplace statistics',
    schema: {
      example: {
        demands: { total: 142, active: 38, fulfilled: 12, expiringSoon: 7 },
        listings: { total: 87, active: 45, removed: 3, lowProofScore: 9 },
        orders: { total: 34, completed: 22, disputed: 2, inProgress: 4, totalVolume: 42500000 },
        matches: { total: 156, conversionRate: 0.22 }
      }
    }
  })
  getStats() {
    return this.adminService.getStats();
  }
}
