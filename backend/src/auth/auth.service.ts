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
import type { JwtPayload } from './strategies/jwt.strategy'
import type { RegisterDto, OnboardingDto } from './dto/auth.dto'

@Injectable()
export class AuthService {
  constructor(
    private prisma:  PrismaService,
    private jwt:     JwtService,
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

    const token = this.jwt.sign(
      { sub: email, email, type: 'magic_link' } satisfies Omit<JwtPayload, 'sub'> & { sub: string },
      { expiresIn: this.config.get('MAGIC_LINK_EXPIRES_IN', '15m') },
    )

    await this.mail.sendMagicLink(email, token)
    return { ok: true }
  }

  async verifyMagicLink(token: string) {
    let payload: any
    try {
      payload = this.jwt.verify(token)
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

    // If user exists, issue access token immediately
    if (existingUser) {
      return {
        accessToken:     this.issueAccessToken(existingUser.id, existingUser.email),
        needsOnboarding: false,
        hasPassword:     !!(existingUser.passwordHash),
        user:            existingUser,
      }
    }

    // New user — issue a short-lived onboarding token (not a full access token)
    const onboardingToken = this.jwt.sign(
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
      accessToken: this.issueAccessToken(user.id, user.email),
      user,
    }
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } })
    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials.')

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) throw new UnauthorizedException('Invalid credentials.')

    return {
      accessToken: this.issueAccessToken(user.id, user.email),
      user,
    }
  }

  // ─── Onboarding (after magic link for new users) ─────────────────────────────

  async completeOnboarding(email: string, dto: OnboardingDto) {
    const existing = await this.prisma.user.findUnique({ where: { email } })
    if (existing) {
      return {
        accessToken: this.issueAccessToken(existing.id, existing.email),
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
      accessToken: this.issueAccessToken(user.id, user.email),
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
    return this.jwt.sign(payload, {
      expiresIn: this.config.get('JWT_EXPIRES_IN', '7d'),
    })
  }
}
