import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../prisma/prisma.service'

export interface JwtPayload {
  sub: string   // user id
  email: string
  type: 'access' | 'magic_link' | 'password_reset'
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey:    config.get('JWT_SECRET', 'dev-secret'),
    })
  }

  async validate(payload: JwtPayload) {
    if (payload.type !== 'access') throw new UnauthorizedException()

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { buyerProfile: true, sellerProfile: true },
    })

    if (!user) throw new UnauthorizedException()
    return user
  }
}
