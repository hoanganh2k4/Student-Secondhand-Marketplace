import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger'
import { Controller, Get, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common'
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

  @Get('listings')
  @ApiOperation({ summary: 'List all listings', description: 'Admin only. Returns all listings with seller info.' })
  @ApiResponse({
    status: 200,
    description: 'Array of listings',
    schema: {
      example: [
        { id: 'listing-uuid', title: 'MacBook Air M1', status: 'active', priceExpectation: '18000000', createdAt: '2026-04-01T08:00:00.000Z' },
      ],
    },
  })
  listListings() {
    return this.adminService.listAllListings()
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
    return this.adminService.removeListing(id)
  }
}
