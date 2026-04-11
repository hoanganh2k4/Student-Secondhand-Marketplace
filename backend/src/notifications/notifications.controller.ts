import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { Controller, Get, Patch, Param, UseGuards, Request } from '@nestjs/common'
import { JwtAuthGuard }          from '../auth/guards/jwt-auth.guard'
import { NotificationsService }  from './notifications.service'

const NOTIFICATION_EXAMPLE = {
  id: 'notif-uuid-here',
  userId: 'user-uuid-here',
  type: 'match_proposed',
  referenceType: 'match',
  referenceId: 'match-uuid-here',
  body: 'Có 1 match mới cho demand "Cần mua laptop sinh viên" — độ phù hợp 78%',
  read: false,
  createdAt: '2026-04-11T10:00:00.000Z',
}

@ApiBearerAuth('access-token')
@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for current user', description: 'Returns last 50 notifications ordered by createdAt descending.' })
  @ApiResponse({
    status: 200,
    description: 'Array of notifications',
    schema: {
      example: [
        NOTIFICATION_EXAMPLE,
        {
          ...NOTIFICATION_EXAMPLE,
          id: 'notif-2-uuid',
          type: 'match_active',
          body: 'Match đã được cả hai bên xác nhận. Cuộc trò chuyện đã mở!',
          referenceType: 'conversation',
          referenceId: 'conv-uuid-here',
          read: true,
          createdAt: '2026-04-11T10:05:00.000Z',
        },
        {
          ...NOTIFICATION_EXAMPLE,
          id: 'notif-3-uuid',
          type: 'offer_received',
          body: 'Bạn nhận được một offer mới: 17.500.000 ₫',
          referenceType: 'offer',
          referenceId: 'offer-uuid-here',
          read: false,
          createdAt: '2026-04-11T10:20:00.000Z',
        },
        {
          ...NOTIFICATION_EXAMPLE,
          id: 'notif-4-uuid',
          type: 'order_created',
          body: 'Đơn hàng mới được tạo từ offer của bạn. Kiểm tra ngay!',
          referenceType: 'order',
          referenceId: 'order-uuid-here',
          read: false,
          createdAt: '2026-04-11T11:00:00.000Z',
        },
      ],
    },
  })
  list(@Request() req: any) {
    return this.notificationsService.list(req.user.id)
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read',
    schema: { example: { ...NOTIFICATION_EXAMPLE, read: true } },
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found',
    schema: { example: { statusCode: 404, message: 'Notification not found.', error: 'Not Found' } },
  })
  markRead(@Request() req: any, @Param('id') id: string) {
    return this.notificationsService.markRead(req.user.id, id)
  }
}
