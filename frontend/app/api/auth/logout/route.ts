import { NextResponse } from 'next/server'
import { cookies }      from 'next/headers'

export async function POST() {
  const cookieStore = await cookies()

  const res = NextResponse.json({ ok: true })

  // Clear both tokens by setting maxAge=0
  const clearOpts = {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge:   0,
    path:     '/',
  }
  res.cookies.set('access_token',  '', clearOpts)
  res.cookies.set('refresh_token', '', clearOpts)

  return res
}
