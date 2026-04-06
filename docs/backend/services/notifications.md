# Notification System

> Location in repo: `lib/notifications/sender.ts`
> Channels: In-app (database) + Email (Resend)
> Email templates: `emails/*.tsx` (React Email)

---

## notify() Function

A single shared function writes to the `notifications` table AND sends an email. Every system event that requires user notification calls this function.

```typescript
// lib/notifications/sender.ts
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'

const resend = new Resend(process.env.RESEND_API_KEY)

type NotificationType =
  | 'new_match'
  | 'evidence_request'
  | 'evidence_fulfilled'
  | 'offer_received'
  | 'offer_accepted'
  | 'offer_rejected'
  | 'order_created'
  | 'order_completion_prompt'
  | 'conversation_closing_soon'

interface NotifyParams {
  userId:        string
  userEmail:     string
  type:          NotificationType
  referenceType: string
  referenceId:   string
  body:          string          // in-app notification body
  emailSubject:  string
  emailTemplate: React.ReactElement
}

export async function notify(params: NotifyParams): Promise<void> {
  // Write in-app notification (always)
  await prisma.notification.create({
    data: {
      userId:        params.userId,
      type:          params.type,
      referenceType: params.referenceType,
      referenceId:   params.referenceId,
      body:          params.body,
    }
  })

  // Send email (best-effort — do not block on failure)
  await resend.emails.send({
    from:    `UniSwap <noreply@${process.env.NEXT_PUBLIC_APP_DOMAIN}>`,
    to:      params.userEmail,
    subject: params.emailSubject,
    react:   params.emailTemplate,
  }).catch(err => console.error('Email send failed:', err))
}
```

---

## Trigger Points

| Event | Who is notified | Type | Template |
|-------|----------------|------|---------|
| Match created (score ≥ 60) | Buyer + Seller | `new_match` | `MatchFound.tsx` |
| EvidenceRequest created | Seller | `evidence_request` | `EvidenceRequested.tsx` |
| EvidenceRequest fulfilled | Buyer | `evidence_fulfilled` | `EvidenceFulfilled.tsx` |
| Offer created | Recipient (other party) | `offer_received` | `OfferReceived.tsx` |
| Offer accepted | Offer creator | `offer_accepted` | `OfferAccepted.tsx` |
| Offer rejected | Offer creator | `offer_rejected` | `OfferRejected.tsx` |
| Order created | Buyer + Seller | `order_created` | `OrderCreated.tsx` |
| Meetup time passed | Buyer + Seller | `order_completion_prompt` | `CompletionPrompt.tsx` |
| Conversation closing in 2 days | Buyer + Seller | `conversation_closing_soon` | `InactivityWarning.tsx` |

---

## Example Email Template

```tsx
// emails/MatchFound.tsx
import { Html, Head, Body, Container, Text, Button, Hr } from '@react-email/components'

interface Props {
  recipientName: string
  matchScore: number
  productTitle: string
  demandTitle: string
  matchUrl: string
}

export default function MatchFound({ recipientName, matchScore, productTitle, demandTitle, matchUrl }: Props) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'Inter, sans-serif', background: '#f3f4f6' }}>
        <Container style={{ background: '#ffffff', padding: '32px', borderRadius: '8px', maxWidth: '480px', margin: '32px auto' }}>
          <Text style={{ fontSize: '20px', fontWeight: 'bold' }}>New match found 🎯</Text>
          <Text>Hi {recipientName},</Text>
          <Text>
            We found a <strong>{matchScore}/100</strong> match between <strong>{productTitle}</strong> and <strong>{demandTitle}</strong>.
          </Text>
          <Button href={matchUrl} style={{ background: '#2563EB', color: '#fff', padding: '12px 24px', borderRadius: '8px' }}>
            View Match
          </Button>
          <Hr />
          <Text style={{ fontSize: '12px', color: '#6b7280' }}>UniSwap · Your campus marketplace</Text>
        </Container>
      </Body>
    </Html>
  )
}
```

---

## In-App Notification Feed

The notification bell reads unread count and fetches the list from the `notifications` table:

```typescript
// Reading unread count — called from a server component or TanStack Query
const unreadCount = await prisma.notification.count({
  where: { userId: user.id, read: false }
})

// Marking as read when user opens the notification center
await prisma.notification.updateMany({
  where: { userId: user.id, read: false },
  data:  { read: true }
})
```

Real-time badge update uses Supabase Realtime subscription on the `notifications` table filtered by `user_id`. See [frontend/realtime.md](../../frontend/realtime.md).
