# Notification System

> Location in repo: `backend/src/notifications/notifications.service.ts`
> Channels: In-app (database write) + Email (Nodemailer SMTP via Gmail App Password)

---

## notify() Function

A single shared function writes to the `notifications` table AND sends an email. Every system event that requires user notification calls this function.

```typescript
// notifications.service.ts
async notify(
  userId:        string,
  type:          string,
  body:          string,
  referenceType: string,
  referenceId:   string,
): Promise<void>
```

Steps:
1. Writes a row to `notifications` table
2. Looks up the user's email address
3. Sends email via Nodemailer SMTP (best-effort — does not throw on failure)

---

## Email Config

Email is sent via **Nodemailer** using Gmail SMTP with an App Password.

```typescript
// Configured from environment variables
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,   // smtp.gmail.com
  port:   Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,   // Gmail address
    pass: process.env.SMTP_PASS,   // Gmail App Password (not account password)
  },
})
```

Required env vars: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

---

## Trigger Points

| Event | Who is notified | Type |
|-------|----------------|------|
| Match created | Buyer + Seller | `new_match` |
| One side acknowledges match | Other party | `match_acknowledged` |
| Order request accepted | Initiator | `order_request_accepted` |
| Order request rejected | Initiator | `order_request_rejected` |
| Order request info filled | Other party | `order_request_filled` |
| Order created | Buyer + Seller | `order_created` |
| One side confirms order | Other party | `order_confirmed_partial` |
| Order completed | Buyer + Seller | `order_completed` |
| Order cancelled | Other party | `order_cancelled` |
| Dispute filed | Other party | `dispute_filed` |
| Review received | Reviewed user | `review_received` |

---

## In-App Notification Feed

Unread count and list are fetched from the `notifications` table:

```typescript
// GET /api/notifications
// Returns all notifications for the authenticated user, ordered by createdAt desc

// PATCH /api/notifications/:id/read
// Marks a single notification as read
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications` | List all notifications for current user |
| PATCH | `/api/notifications/:id/read` | Mark as read |
