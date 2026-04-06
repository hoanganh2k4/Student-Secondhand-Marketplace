# Background Jobs (Supabase Edge Functions)

> Runtime: Deno (Supabase Edge Functions)
> Trigger: Cron schedule (configured in Supabase Dashboard)
> Location in repo: `supabase/functions/`

---

## Overview

Four jobs handle all time-based state transitions. They are the only processes that mutate objects based on time rather than user action.

| Function | Cron | What it does |
|----------|------|-------------|
| `expire-demands` | `0 * * * *` (every hour) | Sets expired DemandRequests to `expired` |
| `expire-listings` | `0 * * * *` (every hour) | Sets expired ProductListings to `expired` |
| `expire-offers` | `*/15 * * * *` (every 15 min) | Sets expired pending Offers to `expired` |
| `close-inactive-conversations` | `0 */6 * * *` (every 6 hours) | Closes conversations past `auto_close_at`; sends warning at -2 days |

---

## expire-demands

```typescript
// supabase/functions/expire-demands/index.ts
import { createClient } from '@supabase/supabase-js'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { error, count } = await supabase
    .from('demand_requests')
    .update({ status: 'expired' })
    .lt('expires_at', new Date().toISOString())
    .not('status', 'in', '("expired","cancelled","fulfilled")')
    .select('id', { count: 'exact' })

  console.log(`expire-demands: ${count} updated, error: ${error?.message ?? 'none'}`)
  return new Response(JSON.stringify({ count, error }), { status: error ? 500 : 200 })
})
```

---

## expire-listings

```typescript
// supabase/functions/expire-listings/index.ts
import { createClient } from '@supabase/supabase-js'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { error, count } = await supabase
    .from('product_listings')
    .update({ status: 'expired' })
    .lt('expires_at', new Date().toISOString())
    .not('status', 'in', '("expired","sold","removed")')
    .select('id', { count: 'exact' })

  console.log(`expire-listings: ${count} updated, error: ${error?.message ?? 'none'}`)
  return new Response(JSON.stringify({ count, error }), { status: error ? 500 : 200 })
})
```

---

## expire-offers

```typescript
// supabase/functions/expire-offers/index.ts
import { createClient } from '@supabase/supabase-js'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { error, count } = await supabase
    .from('offers')
    .update({ status: 'expired' })
    .lt('expires_at', new Date().toISOString())
    .eq('status', 'pending')
    .select('id', { count: 'exact' })

  console.log(`expire-offers: ${count} updated, error: ${error?.message ?? 'none'}`)
  return new Response(JSON.stringify({ count, error }), { status: error ? 500 : 200 })
})
```

---

## close-inactive-conversations

This function does two things:
1. Sends a warning notification to conversations that will auto-close in 2 days.
2. Closes conversations that have passed `auto_close_at`.

```typescript
// supabase/functions/close-inactive-conversations/index.ts
import { createClient } from '@supabase/supabase-js'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const now          = new Date()
  const twoDaysLater = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)

  // 1. Close conversations past auto_close_at
  const { error: closeError, count: closedCount } = await supabase
    .from('conversations')
    .update({ status: 'closed', close_reason: 'expired' })
    .lt('auto_close_at', now.toISOString())
    .eq('status', 'active')
    .select('id', { count: 'exact' })

  // 2. Warn conversations closing within 2 days
  // (In MVP: fetch them and call notify() for each participant)
  const { data: soonClosing } = await supabase
    .from('conversations')
    .select('id, buyer_user_id, seller_user_id')
    .lt('auto_close_at', twoDaysLater.toISOString())
    .gt('auto_close_at', now.toISOString())
    .eq('status', 'active')

  // Notify each participant of the upcoming close
  for (const conv of soonClosing ?? []) {
    for (const userId of [conv.buyer_user_id, conv.seller_user_id]) {
      await supabase.from('notifications').insert({
        user_id:        userId,
        type:           'conversation_closing_soon',
        reference_type: 'conversation',
        reference_id:   conv.id,
        body:           'Your conversation will auto-close in 2 days due to inactivity.',
        read:           false,
      })
    }
  }

  console.log(`close-inactive-conversations: closed ${closedCount}, warned ${soonClosing?.length ?? 0}`)
  return new Response(
    JSON.stringify({ closedCount, warnedCount: soonClosing?.length }),
    { status: closeError ? 500 : 200 }
  )
})
```

---

## Deploying Edge Functions

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Deploy all functions
supabase functions deploy expire-demands
supabase functions deploy expire-listings
supabase functions deploy expire-offers
supabase functions deploy close-inactive-conversations
```

---

## Setting Cron Schedules

In the Supabase Dashboard: **Edge Functions → [function name] → Schedules → Add schedule**

| Function | Schedule expression | Human description |
|----------|--------------------|--------------------|
| expire-demands | `0 * * * *` | Every hour at minute 0 |
| expire-listings | `0 * * * *` | Every hour at minute 0 |
| expire-offers | `*/15 * * * *` | Every 15 minutes |
| close-inactive-conversations | `0 */6 * * *` | Every 6 hours |

All functions use the service role key from `SUPABASE_SERVICE_ROLE_KEY` (set in Supabase Dashboard under Edge Functions → Secrets).
