const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'

type RequestOptions = {
  method?: string
  body?:   unknown
  token?:  string
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`
  }

  const res = await fetch(`${API_URL}${path}`, {
    method:  options.method ?? 'GET',
    headers,
    body:    options.body ? JSON.stringify(options.body) : undefined,
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new ApiError(res.status, data?.message ?? data?.error ?? 'Request failed')
  }

  return data as T
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export const api = {
  auth: {
    sendMagicLink: (email: string) =>
      request('/auth/magic-link', { method: 'POST', body: { email } }),

    verifyMagicLink: (token: string) =>
      request<{ accessToken: string; needsOnboarding: boolean }>(`/auth/callback?token=${token}`),

    register: (body: {
      email: string
      password: string
      name: string
      university: string
      graduationYear?: number
    }) => request<{ accessToken: string }>('/auth/register', { method: 'POST', body }),

    login: (email: string, password: string) =>
      request<{ accessToken: string }>('/auth/login', { method: 'POST', body: { email, password } }),

    onboarding: (
      token: string,
      body: { email: string; name: string; university: string; graduationYear?: number },
    ) =>
      request<{ accessToken: string }>('/auth/onboarding', {
        method: 'POST',
        token,
        body,
      }),

    me: (token: string) =>
      request('/auth/me', { token }),
  },
}
