import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'

/**
 * Server Component helper — fetches current user from NestJS using the JWT cookie.
 * Redirects to /login if the token is missing or invalid.
 */
export async function requireAuthOrRedirect() {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value

  if (!token) redirect('/login')

  const res = await fetch(`${API_URL}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!res.ok) redirect('/login')

  return res.json()
}
