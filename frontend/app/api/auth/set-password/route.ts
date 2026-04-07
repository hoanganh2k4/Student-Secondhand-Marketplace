import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value

  if (!token) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  const res = await fetch(`${API_URL}/auth/set-password`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
