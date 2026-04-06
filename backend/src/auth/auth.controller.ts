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

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  // POST /api/auth/magic-link — send magic link email
  @Post('magic-link')
  sendMagicLink(@Body() dto: SendMagicLinkDto) {
    return this.authService.sendMagicLink(dto.email)
  }

  // GET /api/auth/callback?token=... — verify magic link
  @Get('callback')
  verifyMagicLink(@Query() dto: VerifyMagicLinkDto) {
    return this.authService.verifyMagicLink(dto.token)
  }

  // POST /api/auth/onboarding — complete profile after magic link signup
  @Post('onboarding')
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

  // GET /api/auth/check-email?email= — check if email has password
  @Get('check-email')
  checkEmail(@Query('email') email: string) {
    if (!email) throw new BadRequestException('email is required')
    return this.authService.checkEmail(email)
  }

  // POST /api/auth/set-password — set/update password (requires JWT)
  @Post('set-password')
  @UseGuards(JwtAuthGuard)
  setPassword(@Request() req: any, @Body() body: { password: string }) {
    if (!body.password || body.password.length < 8)
      throw new BadRequestException('Password must be at least 8 characters.')
    return this.authService.setPassword(req.user.id, body.password)
  }

  // POST /api/auth/register — register with email + password
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto)
  }

  // POST /api/auth/login — login with email + password
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password)
  }

  // GET /api/auth/me — get current user (requires JWT)
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Request() req: any) {
    return req.user
  }
}
