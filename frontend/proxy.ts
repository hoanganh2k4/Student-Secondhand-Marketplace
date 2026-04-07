import { NextRequest, NextResponse } from 'next/server'

// Paths that do not require an access_token cookie
const PUBLIC_PREFIXES = [
  '/login',
  '/auth/',   // all auth route handlers (callback, set-cookie, logout)
  '/api/',    // all Next.js internal API routes
  '/onboarding',
]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token = request.cookies.get('access_token')?.value

  if (!token) {
    // Let prefetch requests pass through silently so Next.js 16's incremental
    // prefetcher doesn't show "Content unavailable" in the browser console.
    // The server component's requireAuthOrRedirect() will handle the redirect.
    const isPrefetch =
      request.headers.get('next-router-prefetch') === '1' ||
      request.headers.get('purpose') === 'prefetch'

    if (isPrefetch) {
      return NextResponse.next()
    }

    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
