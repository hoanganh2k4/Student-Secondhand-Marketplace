import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const maxDuration = 60
export const dynamic     = 'force-dynamic'

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

async function doRefresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refreshToken }),
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

async function proxyRequest(request: NextRequest, params: { path: string[] }) {
  const cookieStore  = await cookies()
  let accessToken    = cookieStore.get('access_token')?.value
  const refreshToken = cookieStore.get('refresh_token')?.value

  // Read body once upfront (stream can only be consumed once)
  let body: Buffer | undefined
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const buf = await request.arrayBuffer()
    if (buf.byteLength > 0) body = Buffer.from(buf)
  }

  const path     = params.path.join('/')
  const url      = `${API_URL}/${path}${request.nextUrl.search}`
  const contentType = request.headers.get('content-type') ?? ''

  const makeBackendRequest = (token: string) => {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
    if (contentType) headers['Content-Type'] = contentType
    return fetch(url, { method: request.method, headers, body })
  }

  const buildResponse = (backendRes: Response, newTokens?: { accessToken: string; refreshToken: string } | null) => {
    return backendRes.text().then(text => {
      const res = new NextResponse(text, {
        status:  backendRes.status,
        headers: { 'Content-Type': backendRes.headers.get('content-type') ?? 'application/json' },
      })
      if (newTokens) {
        res.cookies.set('access_token',  newTokens.accessToken,  cookieOpts(ACCESS_MAX_AGE))
        res.cookies.set('refresh_token', newTokens.refreshToken, cookieOpts(REFRESH_MAX_AGE))
      }
      return res
    })
  }

  // No access token — try refresh immediately
  if (!accessToken) {
    if (!refreshToken) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    const newTokens = await doRefresh(refreshToken)
    if (!newTokens) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    accessToken = newTokens.accessToken
    const backendRes = await makeBackendRequest(accessToken)
    return buildResponse(backendRes, newTokens)
  }

  // Try with existing access token
  const backendRes = await makeBackendRequest(accessToken)

  // Auto-refresh on 401
  if (backendRes.status === 401 && refreshToken) {
    const newTokens = await doRefresh(refreshToken)
    if (!newTokens) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    const retryRes = await makeBackendRequest(newTokens.accessToken)
    return buildResponse(retryRes, newTokens)
  }

  return buildResponse(backendRes)
}

export const GET    = (req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) =>
  params.then(p => proxyRequest(req, p))
export const POST   = (req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) =>
  params.then(p => proxyRequest(req, p))
export const PATCH  = (req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) =>
  params.then(p => proxyRequest(req, p))
export const DELETE = (req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) =>
  params.then(p => proxyRequest(req, p))
