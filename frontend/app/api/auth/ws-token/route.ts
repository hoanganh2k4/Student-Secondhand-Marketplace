import { NextResponse } from 'next/server'
import { cookies }      from 'next/headers'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'

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

const cookieOpts = (maxAge: number) => ({
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge,
  path:     '/',
})

export async function GET() {
  const cookieStore  = await cookies()
  const accessToken  = cookieStore.get('access_token')?.value
  const refreshToken = cookieStore.get('refresh_token')?.value

  // Token valid and not expiring within 30 seconds — use it
  if (accessToken && jwtExpiresInMs(accessToken) > 30_000) {
    return NextResponse.json({ token: accessToken })
  }

  // Access token missing or about to expire — try refresh
  if (!refreshToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const newTokens = await doRefresh(refreshToken)
  if (!newTokens) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const res = NextResponse.json({ token: newTokens.accessToken })
  res.cookies.set('access_token',  newTokens.accessToken,  cookieOpts(15 * 60))
  res.cookies.set('refresh_token', newTokens.refreshToken, cookieOpts(7 * 24 * 60 * 60))
  return res
}
