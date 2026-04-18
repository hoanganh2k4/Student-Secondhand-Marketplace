import { NextRequest, NextResponse } from 'next/server'

const API_URL         = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'
const ACCESS_MAX_AGE  = 15 * 60
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60

function cookieOpts(maxAge: number) {
  return {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge,
    path:     '/',
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(`${origin}/login?error=missing_token`)
  }

  const res = await fetch(`${API_URL}/auth/callback?token=${token}`)

  if (!res.ok) {
    return NextResponse.redirect(`${origin}/login?error=invalid_token`)
  }

  const { accessToken, refreshToken, needsOnboarding, hasPassword } = await res.json()

  const destination = needsOnboarding
    ? `${origin}/onboarding?token=${encodeURIComponent(accessToken)}`
    : !hasPassword
    ? `${origin}/profile/set-password`
    : `${origin}/`

  const response = NextResponse.redirect(destination)
  response.cookies.set('access_token',  accessToken,  cookieOpts(ACCESS_MAX_AGE))
  if (refreshToken) {
    response.cookies.set('refresh_token', refreshToken, cookieOpts(REFRESH_MAX_AGE))
  }

  return response
}
