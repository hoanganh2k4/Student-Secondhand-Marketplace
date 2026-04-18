import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { MailService } from '../mail/mail.service'
import * as bcrypt from 'bcrypt'
import * as jwt from 'jsonwebtoken'
import type { JwtPayload } from './strategies/jwt.strategy'
import type { RegisterDto, OnboardingDto } from './dto/auth.dto'

@Injectable()
export class AuthService {
  constructor(
    private prisma:  PrismaService,
    private jwtSvc:  JwtService,
    private mail:    MailService,
    private config:  ConfigService,
  ) {}

  // ─── Domain validation ───────────────────────────────────────────────────────

  private validateDomain(email: string) {
    const domains = (this.config.get('ALLOWED_EMAIL_DOMAINS') ?? '')
      .split(',').map((d: string) => d.trim()).filter(Boolean)

    if (domains.length === 0) return

    const domain = email.split('@')[1]
    if (!domains.includes(domain)) {
      throw new ForbiddenException('Only university email addresses are accepted.')
    }
  }

  // ─── Magic link ──────────────────────────────────────────────────────────────

  async sendMagicLink(email: string) {
    this.validateDomain(email)

    const token = this.jwtSvc.sign(
      { sub: email, email, type: 'magic_link' } satisfies Omit<JwtPayload, 'sub'> & { sub: string },
      { expiresIn: this.config.get('MAGIC_LINK_EXPIRES_IN', '15m') },
    )

    await this.mail.sendMagicLink(email, token)
    return { ok: true }
  }

  async verifyMagicLink(token: string) {
    let payload: any
    try {
      payload = this.jwtSvc.verify(token)
    } catch {
      throw new UnauthorizedException('Invalid or expired magic link.')
    }

    if (payload.type !== 'magic_link') {
      throw new UnauthorizedException('Invalid token type.')
    }

    const email = payload.email as string
    this.validateDomain(email)

    const existingUser = await this.prisma.user.findUnique({ where: { email } })
    const needsOnboarding = !existingUser

    if (existingUser) {
      return {
        accessToken:     this.issueAccessToken(existingUser.id, existingUser.email),
        refreshToken:    this.issueRefreshToken(existingUser.id, existingUser.email),
        needsOnboarding: false,
        hasPassword:     !!(existingUser.passwordHash),
        user:            existingUser,
      }
    }

    // New user — issue onboarding token only (no refresh token yet)
    const onboardingToken = this.jwtSvc.sign(
      { sub: email, email, type: 'magic_link' },
      { expiresIn: '1h' },
    )

    return { accessToken: onboardingToken, needsOnboarding: true }
  }

  // ─── Password auth ───────────────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    this.validateDomain(dto.email)

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (existing) throw new ConflictException('Email already registered.')

    const hash = await bcrypt.hash(dto.password, 12)

    const user = await this.prisma.user.create({
      data: {
        email:         dto.email,
        emailVerified: true,
        name:          dto.name,
        passwordHash:  hash,
        studentProfile: {
          create: {
            university:     dto.university,
            graduationYear: dto.graduationYear ?? null,
          },
        },
        buyerProfile:  { create: { preferredCategories: [] } },
        sellerProfile: { create: { preferredMeetupZones: [] } },
      },
    })

    return {
      accessToken:  this.issueAccessToken(user.id, user.email),
      refreshToken: this.issueRefreshToken(user.id, user.email),
      user,
    }
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } })
    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials.')

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) throw new UnauthorizedException('Invalid credentials.')

    return {
      accessToken:  this.issueAccessToken(user.id, user.email),
      refreshToken: this.issueRefreshToken(user.id, user.email),
      user,
    }
  }

  // ─── Refresh token ───────────────────────────────────────────────────────────

  async refresh(refreshToken: string) {
    let payload: any
    try {
      payload = jwt.verify(
        refreshToken,
        this.config.get('JWT_REFRESH_SECRET', 'dev-refresh-secret'),
      )
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token.')
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type.')
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user) throw new UnauthorizedException('User not found.')

    // Rotate: issue new pair
    return {
      accessToken:  this.issueAccessToken(user.id, user.email),
      refreshToken: this.issueRefreshToken(user.id, user.email),
    }
  }

  // ─── Onboarding (after magic link for new users) ─────────────────────────────

  async completeOnboarding(email: string, dto: OnboardingDto) {
    const existing = await this.prisma.user.findUnique({ where: { email } })
    if (existing) {
      return {
        accessToken:  this.issueAccessToken(existing.id, existing.email),
        refreshToken: this.issueRefreshToken(existing.id, existing.email),
        user: existing,
      }
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        emailVerified: true,
        name:          dto.name,
        studentProfile: {
          create: {
            university:     dto.university,
            graduationYear: dto.graduationYear ?? null,
          },
        },
        buyerProfile:  { create: { preferredCategories: [] } },
        sellerProfile: { create: { preferredMeetupZones: [] } },
      },
    })

    return {
      accessToken:  this.issueAccessToken(user.id, user.email),
      refreshToken: this.issueRefreshToken(user.id, user.email),
      user,
    }
  }

  // ─── Check email ─────────────────────────────────────────────────────────────

  async checkEmail(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } })
    return {
      exists:      !!user,
      hasPassword: !!(user?.passwordHash),
    }
  }

  // ─── Set password (authenticated user) ───────────────────────────────────────

  async setPassword(userId: string, password: string) {
    const hash = await bcrypt.hash(password, 12)
    await this.prisma.user.update({
      where: { id: userId },
      data:  { passwordHash: hash },
    })
    return { ok: true }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private issueAccessToken(userId: string, email: string) {
    const payload: JwtPayload = { sub: userId, email, type: 'access' }
    return this.jwtSvc.sign(payload, {
      expiresIn: this.config.get('JWT_EXPIRES_IN', '15m'),
    })
  }

  private issueRefreshToken(userId: string, email: string) {
    const secret  = this.config.get<string>('JWT_REFRESH_SECRET')     ?? 'dev-refresh-secret'
    const expires = this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return jwt.sign({ sub: userId, email, type: 'refresh' }, secret, { expiresIn: expires as any })
  }
}
