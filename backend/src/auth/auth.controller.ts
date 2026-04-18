import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiQuery } from '@nestjs/swagger'
import { Controller, Post, Body, Get, Query, UseGuards, Request, Headers, UnauthorizedException, BadRequestException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { AuthService } from './auth.service'
import {
  SendMagicLinkDto,
  VerifyMagicLinkDto,
  RegisterDto,
  LoginDto,
  OnboardingDto,
} from './dto/auth.dto'
import { JwtAuthGuard } from './guards/jwt-auth.guard'

const USER_EXAMPLE = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  email: 'hoanganh@student.hcmut.edu.vn',
  name: 'Nguyễn Huy Hoàng Anh',
  status: 'active',
  isAdmin: false,
  emailVerified: true,
  createdAt: '2026-01-15T08:00:00.000Z',
  studentProfile: { university: 'HCMUT', verificationStatus: 'email_verified', graduationYear: 2026 },
  buyerProfile: { buyerRating: '4.8', totalOrdersCompleted: 3, trustTier: 'established' },
  sellerProfile: { sellerRating: '4.9', totalListingsCreated: 5, totalOrdersCompleted: 4, trustTier: 'established' },
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('magic-link')
  @ApiOperation({ summary: 'Send magic link email', description: 'Sends a one-time login link to the given email. Valid for 15 minutes.' })
  @ApiResponse({
    status: 201,
    description: 'Magic link sent',
    schema: { example: { message: 'Magic link sent to hoanganh@student.hcmut.edu.vn' } },
  })
  @ApiResponse({ status: 400, description: 'Invalid email address' })
  sendMagicLink(@Body() dto: SendMagicLinkDto) {
    return this.authService.sendMagicLink(dto.email)
  }

  @Get('callback')
  @ApiOperation({ summary: 'Verify magic link token', description: 'Called when user clicks the magic link. Returns a JWT access_token.' })
  @ApiQuery({ name: 'token', required: true, example: 'eyJhbGciOiJIUzI1NiJ9...' })
  @ApiResponse({
    status: 200,
    description: 'Token valid',
    schema: {
      example: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        isNewUser: false,
        user: USER_EXAMPLE,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Token invalid or expired' })
  verifyMagicLink(@Query() dto: VerifyMagicLinkDto) {
    return this.authService.verifyMagicLink(dto.token)
  }

  @Post('onboarding')
  @ApiOperation({ summary: 'Complete profile after magic link signup', description: 'Called after first magic-link login. Requires the magic_link JWT in Authorization header.' })
  @ApiResponse({
    status: 201,
    description: 'Profile completed',
    schema: { example: { access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', user: USER_EXAMPLE } },
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid magic_link token' })
  completeOnboarding(
    @Headers('authorization') auth: string,
    @Body() dto: OnboardingDto,
  ) {
    const token = auth?.replace('Bearer ', '')
    if (!token) throw new UnauthorizedException()
    let payload: any
    try { payload = this.jwtService.verify(token) } catch { throw new UnauthorizedException('Invalid or expired token.') }
    if (payload.type !== 'magic_link') throw new UnauthorizedException('Invalid token type.')
    return this.authService.completeOnboarding(payload.email, dto)
  }

  @Get('check-email')
  @ApiOperation({ summary: 'Check if email has a password set', description: 'Used by login page to decide whether to show password field or magic-link option.' })
  @ApiQuery({ name: 'email', required: true, example: 'hoanganh@student.hcmut.edu.vn' })
  @ApiResponse({
    status: 200,
    description: 'Email check result',
    schema: { example: { hasPassword: true, isRegistered: true } },
  })
  checkEmail(@Query('email') email: string) {
    if (!email) throw new BadRequestException('email is required')
    return this.authService.checkEmail(email)
  }

  @Post('set-password')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Set or update password (requires JWT)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['password'],
      properties: {
        password: { type: 'string', minLength: 8, example: 'NewPassword123!' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Password updated',
    schema: { example: { message: 'Password updated successfully' } },
  })
  @ApiResponse({ status: 400, description: 'Password must be at least 8 characters' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  setPassword(@Request() req: any, @Body() body: { password: string }) {
    if (!body.password || body.password.length < 8)
      throw new BadRequestException('Password must be at least 8 characters.')
    return this.authService.setPassword(req.user.id, body.password)
  }

  @Post('register')
  @ApiOperation({ summary: 'Register with email + password', description: 'Creates account with StudentProfile, BuyerProfile, and SellerProfile.' })
  @ApiResponse({
    status: 201,
    description: 'Account created',
    schema: { example: { access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', user: USER_EXAMPLE } },
  })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto)
  }

  @Post('login')
  @ApiOperation({ summary: 'Login with email + password', description: 'Sets access_token as httpOnly cookie. Use the Authorize button above to authenticate Swagger.' })
  @ApiResponse({
    status: 201,
    description: 'Login successful — sets access_token cookie',
    schema: { example: { access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', user: USER_EXAMPLE } },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password)
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['refreshToken'],
      properties: { refreshToken: { type: 'string' } },
    },
  })
  @ApiResponse({ status: 201, description: 'New access + refresh token pair', schema: { example: { accessToken: 'eyJ...', refreshToken: 'eyJ...' } } })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  refresh(@Body('refreshToken') refreshToken: string) {
    if (!refreshToken) throw new UnauthorizedException('refreshToken is required.')
    return this.authService.refresh(refreshToken)
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'Current user with profiles',
    schema: { example: USER_EXAMPLE },
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  me(@Request() req: any) {
    return req.user
  }
}
