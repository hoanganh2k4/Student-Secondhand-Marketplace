import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// Allow large file uploads (up to 50 MB)
export const maxDuration = 60
export const dynamic     = 'force-dynamic'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'

async function proxyRequest(request: NextRequest, params: { path: string[] }) {
  const cookieStore = await cookies()
  const token       = cookieStore.get('access_token')?.value

  if (!token) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const path        = params.path.join('/')
  const searchQuery = request.nextUrl.search
  const url         = `${API_URL}/${path}${searchQuery}`

  const contentType = request.headers.get('content-type') ?? ''
  const isMultipart = contentType.includes('multipart/form-data')

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  }

  // Always forward Content-Type (including multipart boundary)
  if (contentType) {
    headers['Content-Type'] = contentType
  }

  let body: BodyInit | undefined
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    // For multipart: pipe raw bytes so the original boundary is preserved
    // For JSON/text: read as text
    const buffer = await request.arrayBuffer()
    if (buffer.byteLength > 0) {
      body = Buffer.from(buffer)
    }
  }

  try {
    const backendRes = await fetch(url, {
      method:  request.method,
      headers,
      body,
    })

    const responseData = await backendRes.text()
    return new NextResponse(responseData, {
      status: backendRes.status,
      headers: {
        'Content-Type': backendRes.headers.get('content-type') ?? 'application/json',
      },
    })
  } catch (err) {
    console.error(`[proxy] ${request.method} ${url} failed:`, err)
    return NextResponse.json({ message: 'Backend unavailable' }, { status: 502 })
  }
}

export const GET    = (req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) =>
  params.then(p => proxyRequest(req, p))

export const POST   = (req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) =>
  params.then(p => proxyRequest(req, p))

export const PATCH  = (req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) =>
  params.then(p => proxyRequest(req, p))

export const DELETE = (req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) =>
  params.then(p => proxyRequest(req, p))
