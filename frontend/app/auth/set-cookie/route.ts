import { NextRequest, NextResponse } from 'next/server'

const ACCESS_MAX_AGE  = 15 * 60          // 15 min
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60 // 7 days

function cookieOpts(maxAge: number) {
  return {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge,
    path:     '/',
  }
}

export async function POST(request: NextRequest) {
  const { accessToken, refreshToken } = await request.json()
  if (!accessToken || !refreshToken) {
    return NextResponse.json({ error: 'Missing tokens' }, { status: 400 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set('access_token',  accessToken,  cookieOpts(ACCESS_MAX_AGE))
  response.cookies.set('refresh_token', refreshToken, cookieOpts(REFRESH_MAX_AGE))
  return response
}

// Legacy GET support (magic link callback still uses query param)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const response = NextResponse.json({ ok: true })
  response.cookies.set('access_token', token, cookieOpts(ACCESS_MAX_AGE))
  return response
}
