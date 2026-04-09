import { ApiTags } from '@nestjs/swagger'
import { ApiBearerAuth } from '@nestjs/swagger'
import { Controller, Get, Patch, Param, UseGuards, Request } from '@nestjs/common'
import { JwtAuthGuard }          from '../auth/guards/jwt-auth.guard'
import { NotificationsService }  from './notifications.service'

@ApiBearerAuth('access-token')
@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@Request() req: any) {
    return this.notificationsService.list(req.user.id)
  }

  @Patch(':id/read')
  markRead(@Request() req: any, @Param('id') id: string) {
    return this.notificationsService.markRead(req.user.id, id)
  }
}
