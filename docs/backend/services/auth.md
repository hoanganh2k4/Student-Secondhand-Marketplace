# Authentication and Authorization

> Provider: Supabase Auth
> Auth method: Magic link (email, no password)
> Restriction: University email domains only

---

## University Email Restriction

Enforced at two independent levels so neither can be bypassed alone.

**Level 1 — Supabase Auth hook (signup):**
A `before_user_created` hook validates the email domain against an `allowed_domains` table before the Supabase account is created. Configure this in the Supabase Dashboard under Auth > Hooks.

**Level 2 — Next.js Middleware:**
`middleware.ts` checks `session.user.email` domain on every request to a protected route. If the domain is not in `ALLOWED_EMAIL_DOMAINS`, the session is signed out and the user is redirected to `/login?error=domain`.

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ALLOWED_DOMAINS = process.env.ALLOWED_EMAIL_DOMAINS!.split(',')

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { /* cookie adapter */ } }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const isProtected = !request.nextUrl.pathname.startsWith('/(auth)')

  if (!session && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (session) {
    const domain = session.user.email!.split('@')[1]
    if (!ALLOWED_DOMAINS.includes(domain)) {
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL('/login?error=domain', request.url))
    }
  }

  return response
}
```

---

## requireAuth Helper

Every API route calls this shared helper. It extracts the session, loads the user with their profiles, and returns the full user object. If the session is missing, it throws `'UNAUTHORIZED'` which the route handler catches and converts to a 401 response.

```typescript
// lib/utils/auth.ts
import { createServerClient } from '@supabase/ssr'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

export async function requireAuth() {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookies().get(name)?.value } }
  )

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('UNAUTHORIZED')

  const user = await prisma.user.findUniqueOrThrow({
    where: { email: session.user.email! },
    include: { buyerProfile: true, sellerProfile: true }
  })
  return user
}
```

Usage in any API route:

```typescript
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    // user.buyerProfile and user.sellerProfile are available
    // ...
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // ...
  }
}
```

---

## Supabase Client Variants

Three client instances are used depending on context:

| File | Client type | Used for |
|------|------------|---------|
| `lib/supabase/client.ts` | `createBrowserClient` | Client components, React hooks |
| `lib/supabase/server.ts` | `createServerClient` | Server components, API routes |
| `lib/supabase/admin.ts` | `createClient` with service role key | Admin operations that bypass Row Level Security |

```typescript
// lib/supabase/admin.ts
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

The admin client is only imported in server-side code (API routes, Edge Functions). It must never be used in client components.

---

## Admin Guard

Admin-only routes (under `/admin`) check an `isAdmin` boolean on the `User` model. Add this field to the Prisma schema.

In middleware: check `user.isAdmin` before allowing access to `/admin/**` paths.

In API route handlers: call `requireAuth()` then assert `user.isAdmin === true`, returning 403 if not.

Admin API operations that need to bypass Row Level Security (e.g., reading another user's private data for dispute resolution) use `createAdminClient()` instead of the regular server client.

---

## Row Level Security (Supabase RLS)

Enable RLS on all tables. Key policies:

| Table | Read | Write |
|-------|------|-------|
| `users` | Own row only | Own row only |
| `demand_requests` | Own rows + matched listings' sellers | Own rows |
| `product_listings` | All authenticated users | Own rows |
| `proof_assets` | All authenticated users | Own rows |
| `conversations` | Participant only (buyer or seller) | Participant only |
| `messages` | Conversation participant | Conversation participant |
| `offers` | Conversation participant | Conversation participant |
| `orders` | Buyer or seller of order | Buyer or seller of order |
| `disputes` | Filed-by user or assigned admin | Filed-by user or admin |
| `notifications` | Own rows | System only (service role) |

Admin operations use the service-role client which bypasses all RLS policies.
