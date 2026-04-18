import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'

export async function GET() {
  const cookieStore  = await cookies()
  const accessToken  = cookieStore.get('access_token')?.value
  const refreshToken = cookieStore.get('refresh_token')?.value

  if (accessToken) return NextResponse.json({ token: accessToken })

  // Access token missing — try refresh
  if (!refreshToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refreshToken }),
    })
    if (!res.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { accessToken: newAccess, refreshToken: newRefresh } = await res.json()

    const response = NextResponse.json({ token: newAccess })
    response.cookies.set('access_token',  newAccess,  { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 15 * 60, path: '/' })
    response.cookies.set('refresh_token', newRefresh, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60, path: '/' })
    return response
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
