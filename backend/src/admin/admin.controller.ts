import { ApiTags } from '@nestjs/swagger'
import { ApiBearerAuth } from '@nestjs/swagger'
import { Controller, Get, Patch, Post, Param, Body, Query, UseGuards, Request } from '@nestjs/common'
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
  listDisputes() {
    return this.adminService.listDisputes()
  }

  @Patch('disputes/:id/resolve')
  resolveDispute(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.adminService.resolveDispute(req.user.id, id, dto)
  }

  @Get('users')
  listUsers(@Query('status') status?: string) {
    return this.adminService.listUsers(status)
  }

  @Patch('users/:id/suspend')
  suspendUser(@Param('id') id: string, @Body() dto: SuspendUserDto) {
    return this.adminService.suspendUser(id, dto)
  }

  @Patch('users/:id/ban')
  banUser(@Param('id') id: string) {
    return this.adminService.banUser(id)
  }

  @Patch('users/:id/reinstate')
  reinstateUser(@Param('id') id: string) {
    return this.adminService.reinstateUser(id)
  }

  @Patch('listings/:id/remove')
  removeListing(@Param('id') id: string) {
    return this.adminService.removeListing(id)
  }
}
