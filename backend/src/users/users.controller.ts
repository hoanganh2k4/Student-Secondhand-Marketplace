import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger'
import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { UsersService } from './users.service'

const USER_PROFILE_EXAMPLE = {
  id: 'user-uuid-here',
  email: 'hoanganh@student.hcmut.edu.vn',
  name: 'Nguyễn Huy Hoàng Anh',
  phone: '0901234567',
  status: 'active',
  isAdmin: false,
  emailVerified: true,
  createdAt: '2026-01-15T08:00:00.000Z',
  studentProfile: {
    university: 'HCMUT',
    verificationStatus: 'email_verified',
    graduationYear: 2026,
  },
  buyerProfile: {
    buyerRating: '4.8',
    totalOrdersCompleted: 3,
    trustTier: 'established',
    preferredCategories: ['Laptop', 'Điện thoại'],
    defaultLocation: 'Quận 10, TP.HCM',
  },
  sellerProfile: {
    sellerRating: '4.9',
    totalListingsCreated: 5,
    totalOrdersCompleted: 4,
    trustTier: 'established',
    preferredMeetupZones: ['BK cơ sở 2', 'Nhà văn hóa sinh viên'],
    availabilityNotes: 'Thứ 2–6 sau 18h, cuối tuần cả ngày',
  },
}

@ApiBearerAuth('access-token')
@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile with all sub-profiles', description: 'Returns the authenticated user with studentProfile, buyerProfile, and sellerProfile.' })
  @ApiResponse({
    status: 200,
    description: 'Current user with full profiles',
    schema: { example: USER_PROFILE_EXAMPLE },
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  getMe(@Request() req: any) {
    return this.usersService.findById(req.user.id)
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user name or phone' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name:  { type: 'string', example: 'Nguyễn Huy Hoàng Anh' },
        phone: { type: 'string', example: '0901234567' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated',
    schema: { example: { ...USER_PROFILE_EXAMPLE, phone: '0901234567' } },
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  updateMe(
    @Request() req: any,
    @Body() body: { name?: string; phone?: string },
  ) {
    return this.usersService.updateProfile(req.user.id, body)
  }
}
