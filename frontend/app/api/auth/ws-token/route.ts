import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// Returns the access_token cookie value so the browser can authenticate
// WebSocket connections (socket.io connects directly, not through the proxy).
export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ token })
}
