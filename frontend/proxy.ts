import { NextRequest, NextResponse } from 'next/server'

const API_URL         = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'
const ACCESS_MAX_AGE  = 15 * 60
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60

const PUBLIC_PREFIXES = [
  '/login',
  '/register',
  '/auth/',
  '/api/auth/',
  '/payment/result',
  '/onboarding',
]

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some(p => pathname.startsWith(p))
}

function jwtExpiresInMs(token: string): number {
  try {
    const base64url = token.split('.')[1]
    const base64    = base64url.replace(/-/g, '+').replace(/_/g, '/')
    const payload   = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'))
    return payload.exp ? payload.exp * 1000 - Date.now() : 0
  } catch {
    return 0
  }
}

function cookieOpts(maxAge: number) {
  return {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge,
    path:     '/',
  }
}

async function doRefresh(refreshToken: string) {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refreshToken }),
    })
    if (!res.ok) return null
    return res.json() as Promise<{ accessToken: string; refreshToken: string }>
  } catch {
    return null
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublic(pathname)) return NextResponse.next()

  const accessToken  = request.cookies.get('access_token')?.value
  const refreshToken = request.cookies.get('refresh_token')?.value

  const tokenValid = accessToken && jwtExpiresInMs(accessToken) > 30_000

  // Token still valid — proceed
  if (tokenValid) return NextResponse.next()

  // No refresh token — redirect to login (let prefetches pass silently)
  if (!refreshToken) {
    const isPrefetch =
      request.headers.get('next-router-prefetch') === '1' ||
      request.headers.get('purpose') === 'prefetch'
    if (isPrefetch) return NextResponse.next()

    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Try to refresh silently — user stays on current page
  const newTokens = await doRefresh(refreshToken)

  if (!newTokens) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    const res = NextResponse.redirect(loginUrl)
    res.cookies.set('access_token',  '', { maxAge: 0, path: '/' })
    res.cookies.set('refresh_token', '', { maxAge: 0, path: '/' })
    return res
  }

  const res = NextResponse.next()
  res.cookies.set('access_token',  newTokens.accessToken,  cookieOpts(ACCESS_MAX_AGE))
  res.cookies.set('refresh_token', newTokens.refreshToken, cookieOpts(REFRESH_MAX_AGE))
  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
