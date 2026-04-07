# Authentication and Authorization

> Provider: Self-hosted JWT (NestJS)
> Auth methods: Magic link (email OTP) + password
> Restriction: University email domains only (enforced server-side)

---

## Overview

Auth lives entirely in the NestJS backend (`backend/src/auth/`). The frontend never touches JWTs directly — it reads/writes an `access_token` httpOnly cookie set by the NestJS response.

| Flow | Description |
|------|-------------|
| Magic link | User enters email → NestJS sends a time-limited signed token via Resend/Mailhog → user clicks link → token validated → JWT issued |
| Password login | User enters email + password → NestJS validates bcrypt hash → JWT issued |
| Set password | After magic-link login, user can set a password for future logins |

---

## Token Issuance

On successful auth (magic link click or password login), NestJS calls `issueTokens()`:

```typescript
// backend/src/auth/auth.service.ts
async issueTokens(userId: string) {
  const payload = { sub: userId }
  const accessToken = this.jwt.sign(payload, {
    secret:    this.config.get('JWT_SECRET'),
    expiresIn: '7d',
  })
  return { accessToken }
}
```

The controller sets the cookie:

```typescript
// backend/src/auth/auth.controller.ts
@Post('login')
async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
  const { accessToken } = await this.authService.login(dto.email, dto.password)
  res.cookie('access_token', accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure:   process.env.NODE_ENV === 'production',
    maxAge:   7 * 24 * 60 * 60 * 1000,  // 7 days in ms
  })
  return { ok: true }
}
```

---

## JWT Guard

All protected NestJS routes use `JwtAuthGuard`:

```typescript
// backend/src/auth/guards/jwt-auth.guard.ts
import { AuthGuard } from '@nestjs/passport'
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

The JWT strategy reads the token from the `access_token` cookie:

```typescript
// backend/src/auth/strategies/jwt.strategy.ts
import { PassportStrategy } from '@nestjs/passport'
import { Strategy, ExtractJwt } from 'passport-jwt'
import { Request } from 'express'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.['access_token'] ?? null,
      ]),
      secretOrKey: config.get('JWT_SECRET'),
    })
  }

  async validate(payload: { sub: string }) {
    const user = await this.prisma.user.findUnique({
      where:   { id: payload.sub },
      include: { buyerProfile: true, sellerProfile: true },
    })
    if (!user) throw new UnauthorizedException()
    return user   // attached as req.user
  }
}
```

Usage in any controller:

```typescript
@UseGuards(JwtAuthGuard)
@Get('me')
getMe(@Request() req: any) {
  return req.user   // full User with profiles (passwordHash stripped by UsersService)
}
```

---

## University Email Restriction

Enforced in `AuthService.sendMagicLink()` before the email is sent:

```typescript
async sendMagicLink(email: string) {
  const domain = email.split('@')[1]
  const allowed = this.config.get<string>('ALLOWED_EMAIL_DOMAINS').split(',')
  if (!allowed.includes(domain)) {
    throw new ForbiddenException('Email domain not allowed')
  }
  // ... generate token and send email
}
```

A second check runs in `UsersService.create()` to prevent direct user creation via the API.

---

## Magic Link Flow

```
POST /auth/magic-link   { email }
  → validate domain
  → generate 32-byte hex token, hash it (SHA-256), store in DB with 15-min TTL
  → send email via Resend/Mailhog with link: /auth/verify?token=<raw>
  → return { ok: true }

GET /auth/verify?token=<raw>
  → hash the raw token, look up MagicLinkToken row
  → check not expired, not used
  → mark token used
  → upsert User(email)
  → issue JWT, set cookie
  → redirect to /onboarding (new user) or / (existing user)
```

The `MagicLinkToken` table (or equivalent field on User) stores:
- `tokenHash` — SHA-256 of the raw token
- `expiresAt` — 15 minutes from creation
- `usedAt` — null until consumed

---

## Password Flow

```
POST /auth/check-email  { email }
  → returns { exists: boolean, hasPassword: boolean }
  → frontend uses this to decide: send magic link OR show password field

POST /auth/login        { email, password }
  → find user by email
  → bcrypt.compare(password, user.passwordHash)
  → if ok: issue JWT, set cookie
  → return { ok: true }

POST /auth/set-password  (JWT required)
  → bcrypt.hash(password, 12)
  → update user.passwordHash
  → return { ok: true }
```

---

## Frontend Auth Layer

The frontend never reads the `access_token` cookie (httpOnly). Instead:

**`proxy.ts`** (runs at Next.js middleware layer) — checks cookie presence and redirects unauthenticated requests to `/login`:

```typescript
// frontend/proxy.ts
const PUBLIC_PREFIXES = ['/login', '/auth/', '/api/', '/onboarding']

export function proxy(request: NextRequest) {
  if (PUBLIC_PREFIXES.some(p => request.nextUrl.pathname.startsWith(p))) {
    return NextResponse.next()
  }
  const token = request.cookies.get('access_token')?.value
  if (!token) {
    const isPrefetch = request.headers.get('next-router-prefetch') === '1'
    if (isPrefetch) return NextResponse.next()
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return NextResponse.next()
}
```

**Server components** call `GET /api/me` (via the NestJS backend) to get the current user. The cookie is forwarded automatically by the browser.

**Route handlers** in `frontend/app/api/auth/` proxy auth actions to the NestJS backend:

| Next.js route | Proxies to NestJS |
|--------------|-------------------|
| `POST /api/auth/magic-link` | `POST /auth/magic-link` |
| `GET /auth/callback` | `GET /auth/verify?token=` |
| `GET /auth/set-cookie` | sets `access_token` cookie from query param |
| `POST /api/auth/set-password` | `POST /auth/set-password` (reads cookie server-side) |
| `GET /auth/logout` | clears `access_token` cookie, redirects to `/login` |

---

## Admin Guard

Admin-only routes check `user.isAdmin` on the Prisma User model:

```typescript
// backend/src/auth/guards/admin.guard.ts
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest()
    if (!req.user?.isAdmin) throw new ForbiddenException()
    return true
  }
}
```

Usage:

```typescript
@UseGuards(JwtAuthGuard, AdminGuard)
@Post('admin/disputes/:id/resolve')
resolve(@Param('id') id: string, @Body() dto: ResolveDisputeDto) { ... }
```

---

## Authorization Rules Summary

| Route | Guard | Who can access |
|-------|-------|---------------|
| `POST /auth/magic-link` | None | Anyone |
| `GET /auth/verify` | None | Token holder |
| `POST /auth/login` | None | Anyone |
| `GET /auth/me` | JwtAuthGuard | Authenticated user |
| `POST /auth/set-password` | JwtAuthGuard | Authenticated user (own) |
| `GET /demands` | JwtAuthGuard | Any authenticated user |
| `POST /demands` | JwtAuthGuard | Any authenticated user |
| `PATCH /demands/:id` | JwtAuthGuard | Owner only (checked in service) |
| `DELETE /demands/:id` | JwtAuthGuard | Owner only |
| `POST /admin/**` | JwtAuthGuard + AdminGuard | isAdmin users only |
