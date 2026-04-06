# UI Component Architecture

> Framework: Next.js 14 + React 18
> UI library: shadcn/ui (base) + Tailwind CSS (styling)
> State: Zustand (UI state) + TanStack Query (server state)
> Design reference: `EC/src.zip` — Vite prototype with all screen layouts

---

## Design Tokens

Tokens are defined in `styles/theme.css` as CSS variables and mapped into Tailwind via `@theme inline`.

| Token | Value | Use |
|-------|-------|-----|
| `--primary` | `#2563EB` | Blue — CTAs, links, active states |
| `--secondary` / `--accent` | `#EFF6FF` | Light blue tint — category chips, selected rows |
| `--foreground` | `#111827` | Headings and body text |
| `--muted-foreground` | `#4B5563` | Labels, secondary text |
| `--border` | `#D1D5DB` | All dividers and card borders |
| `--muted` | `#F3F4F6` | Info grid backgrounds, sidebar cells |
| `--destructive` | `#DC2626` | Errors, rejection states |
| `--green-600` | `#16A34A` | Active / matched / trusted / high match |
| `--amber-600` | `#D97706` | Pending / warning / medium match |
| `--radius` | `0.75rem` | Default border radius; `rounded-xl` = radius+4px |

Always use the hex values directly in Tailwind arbitrary classes (e.g., `bg-[#2563EB]`, `text-[#4B5563]`) — do not use Tailwind color names like `bg-blue-600` as those don't map exactly to the design tokens.

---

## Shared Components

### StatusBadge

```tsx
// components/shared/StatusBadge.tsx
type StatusBadgeVariant =
  | 'active' | 'verified'
  | 'pending' | 'waiting'
  | 'draft' | 'inactive'
  | 'matched'
  | 'closed' | 'expired'
  | 'rejected' | 'cancelled'

const VARIANTS: Record<StatusBadgeVariant, string> = {
  active:    'bg-[#16A34A]/10 text-[#16A34A]',
  verified:  'bg-[#16A34A]/10 text-[#16A34A]',
  pending:   'bg-[#D97706]/10 text-[#D97706]',
  waiting:   'bg-[#D97706]/10 text-[#D97706]',
  draft:     'bg-[#D1D5DB] text-[#4B5563]',
  inactive:  'bg-[#D1D5DB] text-[#4B5563]',
  matched:   'bg-[#2563EB]/10 text-[#2563EB]',
  closed:    'bg-[#F3F4F6] text-[#4B5563]',
  expired:   'bg-[#F3F4F6] text-[#4B5563]',
  rejected:  'bg-[#DC2626]/10 text-[#DC2626]',
  cancelled: 'bg-[#DC2626]/10 text-[#DC2626]',
}

export function StatusBadge({ variant, children }: { variant: StatusBadgeVariant; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-normal ${VARIANTS[variant]}`}>
      {children}
    </span>
  )
}
```

### MatchScore

Two-line stacked display: score pill above, confidence label below.

```tsx
// components/shared/MatchScore.tsx
export function MatchScore({ score, label }: { score: number; label?: string }) {
  const getColor = () => {
    if (score >= 80) return 'text-[#16A34A] bg-[#16A34A]/10'
    if (score >= 60) return 'text-[#D97706] bg-[#D97706]/10'
    return 'text-[#4B5563] bg-[#D1D5DB]'
  }
  const getLabel = () => {
    if (label) return label
    if (score >= 80) return 'High match'
    if (score >= 60) return 'Medium match'
    return 'Possible match'
  }
  return (
    <div className="inline-flex flex-col items-start gap-0.5">
      <div className={`px-2.5 py-1 rounded-md text-[11px] font-medium ${getColor()}`}>
        {score} / 100
      </div>
      <span className="text-[11px] text-[#4B5563]">{getLabel()}</span>
    </div>
  )
}
```

### TrustTierBadge

```tsx
// components/shared/TrustTierBadge.tsx
import { Shield, Check } from 'lucide-react'

type Tier = 'new' | 'established' | 'trusted'

export function TrustTierBadge({ tier }: { tier: Tier }) {
  if (tier === 'new') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#D1D5DB] text-[#4B5563] text-[11px] font-normal">
      New
    </span>
  )
  if (tier === 'established') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#2563EB]/10 text-[#2563EB] text-[11px] font-normal">
      <Shield className="w-3 h-3" /> Established
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#16A34A]/10 text-[#16A34A] text-[11px] font-normal">
      <Check className="w-3 h-3" /> Trusted
    </span>
  )
}
```

### SkeletonCard

Every list page shows skeletons while data loads — no spinners.

```tsx
// components/shared/SkeletonCard.tsx
export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-[#D1D5DB] p-4 animate-pulse">
      <div className="flex gap-3">
        <div className="w-14 h-14 rounded-lg bg-[#D1D5DB] shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-[#D1D5DB] rounded w-3/4" />
          <div className="h-3 bg-[#D1D5DB] rounded w-1/2" />
          <div className="h-3 bg-[#D1D5DB] rounded w-1/4" />
        </div>
      </div>
    </div>
  )
}
```

---

## Layout Shell

### RootLayout (authenticated pages)

```
RootLayout
├── <main className="flex-1 pb-[80px] overflow-auto">
│     <Outlet />            ← page content
└── <nav> fixed bottom-0, h-16, bg-white, border-t
      5-column grid — Home / Demands / Listings / Chats / Profile
      Active icon: text-[#2563EB], strokeWidth=2.5
      Inactive icon: text-[#4B5563], strokeWidth=2
      Label: text-[11px] font-medium
```

### AuthLayout (unauthenticated pages)

```
AuthLayout
└── <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <Outlet />
```

---

## Screen: Home

```
Home
├── Sticky top bar
│     Left: avatar circle (blue, "U")
│     Right: Bell button (with red dot for unread) + profile initial button
│
├── [hasActivity = true]
│   ├── Hero greeting — "Good morning, {firstName} 👋"
│   │     Subtitle: "{n} new matches and 1 pending evidence request"
│   │
│   ├── Active Demands — horizontal scroll row
│   │     Each card: 220×120px, border rounded-xl
│   │       Category chip (blue), title (line-clamp-2), budget text
│   │       StatusBadge + match count bubble
│   │     + "Post a Demand" dashed card (Plus icon)
│   │
│   ├── Recent Matches — vertical list
│   │     Each row: thumbnail 56×56 + title + MatchScore + ChevronRight + timestamp
│   │     Tap → navigate to /matches/:id
│   │
│   └── Your Listings — horizontal scroll row (same card style as demands)
│         Each card: category chip, title, price (blue bold), StatusBadge
│         + "Create a Listing" dashed card
│
└── [hasActivity = false] Empty state
      Decorative SVG illustration
      "Nothing here yet" heading
      Two CTAs: "Post a Demand" (filled) + "Create a Listing" (outline)
```

---

## Screen: Create Demand (3 steps)

```
CreateDemand
├── Sticky top bar — "New Demand Request" · "Step {n} of 3"
│     Back button: goes to previous step (step 1 → navigate(-1))
│
├── Step 1: What
│   ├── Category grid — 2 columns, 10 categories, icon tiles 80px tall
│   │     Selected: border-[#2563EB] bg-[#EFF6FF]
│   ├── Subcategory chips — horizontal scroll (shown after category selected)
│   │     Selected chip: border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]
│   ├── Description textarea — "What exactly do you need?" (required)
│   └── Special requirements input (optional)
│
├── Step 2: Budget & Preferences
│   ├── Budget range — two side-by-side inputs (Min / Max)
│   ├── Condition selector — 4 equal-width buttons (Any / Good / Very Good / Like New)
│   │     Selected: bg-[#2563EB] text-white
│   ├── Quantity stepper — "−" button · number display · "+" button
│   └── Urgency radio group — 3 options, each a bordered card with radio dot
│         Selected: border-[#2563EB] bg-[#EFF6FF]
│
├── Step 3: Location & Confirm
│   ├── Location dropdown (campus zones)
│   └── Review summary card (bg-[#F3F4F6] rounded-xl)
│         Shows: category, budget range, condition, quantity, location
│         "Edit" button → jumps back to step 1
│
└── Fixed bottom button (above bottom nav, bottom-20)
      "Next →" (steps 1–2) / "Post Demand Request" (step 3)
      Disabled until required fields filled
      Note on step 3: "Your demand expires in 30 days."
```

---

## Screen: Demand Detail

```
DemandDetail
├── Sticky top bar — "Demand Request" + MoreVertical menu
│
├── Status row — StatusBadge + match count ("· {n} matches found")
│
├── Category chip + Title heading (text-[20px] font-semibold)
│     Description paragraph below
│
├── Budget — text-[20px] font-semibold text-[#2563EB]
│
├── Info grid — 2×2, bg-[#F3F4F6] rounded-xl
│     Condition · Quantity · Location · Urgency
│
├── Matches section — "Your Matches"
│   ├── [matches exist] List rows
│   │     thumbnail 56×56 + title + seller name + TrustTierBadge + MatchScore + price
│   │     Tap → /matches/:id
│   └── [no matches] Amber warning banner
│         AlertCircle icon + "We're looking for matching listings…"
│
└── (No FAB — demand detail is read-only)
```

---

## Screen: Match Detail

```
MatchDetail
├── Sticky top bar — "Match Found"
│
├── Match score hero card — border-2 border-[#16A34A] rounded-2xl p-6 text-center
│     Score number: text-[40px] font-bold text-[#16A34A]
│     Confidence label: "High Match" / "Medium Match" / "Possible Match"
│     Dimension bars (for each of 5–6 dimensions):
│       label (w-20) + progress bar (bg-[#16A34A]) + percentage (w-10)
│
├── Comparison grid — 2 columns
│     Left (gray): "Buyer's Demand" — budget, condition, location
│     Right (blue tint): "Seller's Listing" — price, condition, location
│
└── Action buttons (bottom of scroll)
      "Not interested" (ghost, red text) + "Start Conversation" (filled blue)
      Tap "Start Conversation" → navigate to /conversations/:id
```

---

## Screen: Conversation List

```
ConversationList
├── Sticky top bar
│     "Conversations" heading + Filter icon
│     Filter chips: All / Active / Awaiting You (pill buttons)
│
├── "Awaiting action" amber banner (shown when conversations need response)
│
└── Conversation rows
      Per row: thumbnail 48×48 + stage dot (bottom-right corner of image)
        Stage dot colors: verification=blue, clarification=amber, negotiation=green
      Name + TrustTierBadge + product title + last message (italic, line-clamp-1)
      Right: timestamp + unread count bubble (blue circle)
```

---

## Screen: Conversation Thread

```
ConversationThread
├── Sticky top bar
│   ├── Back + counterparty avatar + name + MoreVertical
│   └── Stage progress bar (3 steps with connecting lines)
│         Completed: green circle with checkmark
│         Active: blue circle with step number
│         Pending: gray circle
│         Connecting lines: green if completed, gray if pending
│
├── Message list (flex-1, scrollable)
│   ├── System message: centered, bg-[#EFF6FF] border-l-4 border-[#2563EB], italic
│   ├── Received: left-aligned, bg-[#F3F4F6] rounded-2xl rounded-tl-none
│   └── Sent: right-aligned, bg-[#2563EB] text-white rounded-2xl rounded-tr-none
│
├── [stage === 'clarification'] Floating CTA pill
│     "Ready to make an offer →" — full-width, rounded-full, blue
│
└── Input bar (sticky bottom, above bottom nav)
      Paperclip attachment button
      + Rounded input field ("Ask a question...")
      + Blue send button (rounded-full, Send icon)
      Rate limit hint: "9 messages remaining this hour" (text-[11px])
```

---

## Screen: Profile

```
Profile
├── Sticky top bar — "Profile" + Settings icon
│
├── Profile header
│     Avatar (initial, 64px, blue tint)
│     Name (text-[20px]) + "University Student · Class of {year}"
│     TrustTierBadge + star rating ("4.8 · 12 reviews")
│     "Edit Profile" link
│
├── Stats grid — 3 columns, bg-[#F3F4F6] rounded-xl cells
│     Orders Completed · Listings Active · Demands Active
│
├── My Listings — "See All" link → /listings
│     Row per listing: Package icon + title + price (blue bold) + StatusBadge
│
├── My Demands — "See All" link → /demands
│     Row per demand: Search icon + title + budget + StatusBadge
│
└── Reviews Received
      Per review: avatar initial + reviewer name + star row + comment + item · date
```

---

## Screen: Notifications

```
Notifications
├── Sticky top bar — back arrow + "Notifications" + "Mark all read" link
│
└── Groups: "Today" section and "Earlier" section
      Per notification row:
        Emoji icon (🔵 match / 🟡 evidence / 🟢 offer / etc.)
        + title (font-medium) + body text + timestamp
        + blue dot (top-right) when unread
```

---

## Component Hierarchy: Listing Form

```
app/(main)/listings/new/page.tsx
└── ListingForm (multi-step, controlled by local step state)
    ├── Step 1: Item Details
    │   ├── CategorySelector
    │   │     Grid of category tiles (icon + label)
    │   │     Tap → shows subcategory horizontal chip scroll
    │   ├── ConditionSelector
    │   │     5-option segmented row
    │   │     Tap → shows condition description card below
    │   ├── ConditionNotesInput (textarea)
    │   └── DescriptionInput (textarea, optional)
    │
    ├── Step 2: Photos & Proof
    │   ├── CategoryProofRequirementsBanner
    │   │     Blue info card: "For Electronics: include device on, serial number…"
    │   ├── ProofAssetUploader
    │   │   ├── DropZone (tap or drag to upload)
    │   │   ├── UploadedAssetPreview (grid, 3 columns)
    │   │   │   └── Per asset: thumbnail + quality bar + remove button
    │   │   └── MinimumProofWarning (shown if score < 60)
    │   └── ProofCompletenessMeter
    │         Horizontal progress bar: "Proof completeness: {n}%"
    │         Label: "Add 1 more photo to unlock publishing"
    │
    └── Step 3: Price & Logistics
        ├── PriceInput (large centered currency input)
        ├── PriceFlexibleToggle (switch: "Open to offers")
        ├── QuantityStepper
        ├── LocationSelector (campus zone dropdown)
        ├── AvailabilityWindowInput (text)
        └── PublishButton (disabled until proofCompletenessScore ≥ 60)
```

---

## Component Hierarchy: Conversation Thread (detailed)

```
app/(main)/conversations/[id]/page.tsx
└── ConversationThread
    ├── StageIndicator
    │     Steps: Verification (1) → Clarification (2) → Negotiation (3)
    │     Active step: Blue filled circle; Completed: Green checkmark + line
    │
    ├── MatchSummaryBanner
    │     Two-column: Buyer's Demand info | Seller's Listing info
    │     Shows: category, budget vs price, condition, location
    │
    ├── [stage === 'verification']
    │   ├── ProofAssetGallery
    │   │     Horizontal scroll of thumbnails → lightbox on tap
    │   │     Each thumb: quality indicator dot (green ≥30, red <30)
    │   ├── EvidenceRequestList
    │   │   └── EvidenceRequestCard (per request)
    │   │         Icon + description + status badge
    │   │         [Seller view] "Fulfill" button → opens file picker
    │   │         [Seller view] "Can't provide" → rejection form
    │   └── StageActions (verification)
    │         [Buyer] "Request more evidence" (disabled if 5 reached)
    │         [Buyer] "I'm satisfied →" (advances stage to clarification)
    │
    ├── [stage === 'clarification' | 'negotiation']
    │   ├── MessageThread (real-time via useConversationMessages)
    │   │   └── MessageBubble per message (own=right+blue, other=left+gray, system=center+italic)
    │   ├── MessageInput
    │   │     Disabled in verification stage
    │   │     Shows rate limit hint when < 3 messages remain
    │   └── [stage === 'clarification'] "Ready to make an offer →" pill button (floating)
    │
    └── [stage === 'negotiation']
        ├── ActiveOfferCard (when an offer exists)
        │     Shows: quantity, unit price, total, meetup details, expiry countdown
        │     [Recipient] Accept (green) / Counter / Reject (red)
        │     [Creator] Cancel offer
        └── "Make an Offer +" FAB (when no active offer)
              → opens OfferForm bottom sheet
                Pre-filled from match data
                Fields: quantity, price, fulfillment method, meetup location+time, terms
                Proof snapshot notice (lock icon)
                "Send Offer" CTA
```

---

## State Management Responsibilities

| State type | Tool | Example |
|-----------|------|---------|
| Server data (lists, details) | TanStack Query | `useQuery(['demand', id], fetchDemand)` |
| Real-time (messages, notifications) | Supabase Realtime + useState | `useConversationMessages(id)` |
| Multi-step form state | React `useState` | Step index + partial form values |
| Global UI state (notification badge) | Zustand | `useNotificationStore` |
| URL state (filters, tabs) | Next.js `searchParams` | `?tab=demands&status=active` |

---

## Recurring Layout Patterns

| Pattern | Usage |
|---------|-------|
| Sticky top bar | Every screen. `sticky top-0 bg-white border-b border-[#D1D5DB] px-4 py-3 z-10` |
| Section header with "See all" | `flex items-center justify-between mb-3` — h2 left, `text-[#2563EB] text-[13px] font-medium` right |
| Horizontal scroll card row | `flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar` — negative margin expands to screen edge |
| Info grid (2-col) | `grid grid-cols-2 gap-4 bg-[#F3F4F6] rounded-xl p-4` — label `text-[12px] text-[#4B5563]`, value `text-[14px] font-medium text-[#111827]` |
| Card row (tap to navigate) | `w-full bg-white border border-[#D1D5DB] rounded-xl p-3 flex items-start gap-3 hover:border-[#2563EB] transition-colors` |
| Category chip | `px-2 py-0.5 rounded bg-[#EFF6FF] text-[#2563EB] text-[11px] font-medium` |
| Dashed add card | `border-2 border-dashed border-[#D1D5DB] rounded-xl … hover:border-[#2563EB] hover:bg-[#EFF6FF]/30` |
| Warning banner | `bg-[#D97706]/10 border border-[#D97706]/30 rounded-xl p-4` with `AlertCircle` icon |
| Fixed bottom CTA | `fixed bottom-20 left-0 right-0 p-4 bg-white border-t border-[#D1D5DB]` — `bottom-20` clears the 64px nav bar |
