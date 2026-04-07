import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'

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

  const { accessToken, needsOnboarding } = await res.json()

  const destination = needsOnboarding
    ? `${origin}/onboarding?token=${encodeURIComponent(accessToken)}`
    : `${origin}/`

  const response = NextResponse.redirect(destination)

  // Store JWT in httpOnly cookie
  response.cookies.set('access_token', accessToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 7, // 7 days
    path:     '/',
  })

  return response
}
