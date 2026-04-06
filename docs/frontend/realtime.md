# Real-time Updates (Frontend)

> Provider: Supabase Realtime (Postgres change-data-capture)
> No separate WebSocket server needed in MVP.
> Location: `hooks/`

---

## How It Works

Supabase Realtime listens to Postgres WAL (Write-Ahead Log) changes and pushes them to subscribed clients via WebSocket. The client subscribes to a channel filtered by a specific `conversation_id` or `user_id`, so each client only receives events relevant to them.

---

## useConversationMessages

Subscribes to new messages in a specific conversation. Used in `ConversationThread.tsx`.

```typescript
// hooks/useConversationMessages.ts
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export function useConversationMessages(conversationId: string) {
  const [messages, setMessages] = useState<any[]>([])

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    // Initial fetch
    supabase
      .from('messages')
      .select('*, sender:users(id, name)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .then(({ data }) => setMessages(data ?? []))

    // Real-time subscription for new messages
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        payload => setMessages(prev => [...prev, payload.new])
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId])

  return messages
}
```

---

## useEvidenceRequests

Subscribes to EvidenceRequest changes (INSERT and UPDATE) for a conversation. Used to show real-time status changes when seller fulfills or rejects a request.

```typescript
// hooks/useEvidenceRequests.ts
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export function useEvidenceRequests(conversationId: string) {
  const [requests, setRequests] = useState<any[]>([])

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    supabase
      .from('evidence_requests')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at')
      .then(({ data }) => setRequests(data ?? []))

    const channel = supabase
      .channel(`evidence_requests:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event:  '*',   // INSERT and UPDATE
          schema: 'public',
          table:  'evidence_requests',
          filter: `conversation_id=eq.${conversationId}`,
        },
        payload => {
          setRequests(prev => {
            const existing = prev.findIndex(r => r.id === payload.new.id)
            if (existing >= 0) {
              const updated = [...prev]
              updated[existing] = payload.new
              return updated
            }
            return [...prev, payload.new]
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId])

  return requests
}
```

---

## useNotifications

Subscribes to new notifications for the current user. Drives the notification bell badge count.

```typescript
// hooks/useNotifications.ts
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export function useNotifications(userId: string) {
  const [unreadCount, setUnreadCount] = useState(0)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    // Initial unread count
    supabase
      .from('notifications')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('read', false)
      .then(({ count }) => setUnreadCount(count ?? 0))

    // Subscribe to new notifications
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => setUnreadCount(prev => prev + 1)
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  return unreadCount
}
```

---

## Supabase Realtime Setup Requirements

For Postgres changes to be broadcast, the table must have replication enabled. Run this once per table that needs real-time:

```sql
-- Enable replication for messages
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Enable replication for evidence_requests
ALTER TABLE evidence_requests REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE evidence_requests;

-- Enable replication for notifications
ALTER TABLE notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
```

Run these in the Supabase SQL Editor or as part of a Prisma migration (as raw SQL via `prisma.$executeRaw`).

---

## Concurrent Connections Limit

Supabase free tier: 200 concurrent Realtime connections. Pro tier: 500.

For MVP with < 200 concurrent users this is not a concern. Each active conversation page opens 2 channels (messages + evidence_requests). Monitor connection count in Supabase Dashboard > Realtime > Inspector as user count grows.
