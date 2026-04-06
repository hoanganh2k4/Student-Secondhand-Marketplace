import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { UsersService } from './users.service'

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@Request() req: any) {
    return this.usersService.findById(req.user.id)
  }

  @Patch('me')
  updateMe(
    @Request() req: any,
    @Body() body: { name?: string; phone?: string },
  ) {
    return this.usersService.updateProfile(req.user.id, body)
  }
}
