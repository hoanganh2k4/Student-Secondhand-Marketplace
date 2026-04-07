import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  const response = NextResponse.json({ ok: true })

  response.cookies.set('access_token', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 7,
    path:     '/',
  })

  return response
}
