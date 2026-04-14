# Repository Structure (Frontend)

> Framework: Next.js 16 App Router
> Language: TypeScript throughout
> Auth guard: `proxy.ts` (not `middleware.ts`) — checks `access_token` httpOnly cookie
> Design reference: `EC/src.zip` — Vite/React Router prototype; screen names map 1-to-1 to Next.js pages below.

---

## Full Directory Tree

```
frontend/
├── app/                                    # Next.js App Router root
│   ├── (auth)/                             # Unauthenticated routes (no layout shell)
│   │   ├── login/
│   │   │   └── page.tsx                   # Email → magic link or password login; redirects to /admin if isAdmin
│   │   └── onboarding/
│   │       └── page.tsx                   # Profile setup (name, role, university)
│   │
│   ├── (admin)/                            # Admin-only routes (no bottom nav)
│   │   ├── layout.tsx                     # Minimal bg-gray layout
│   │   └── admin/
│   │       └── page.tsx                   # Admin panel: sticky header + isAdmin guard (redirects to / if not admin)
│   │
│   ├── (main)/                             # Authenticated routes (with nav shell)
│   │   ├── layout.tsx                     # Bottom nav bar (5 tabs) + notification bell
│   │   ├── page.tsx                       # Home "/" — active demands, recent matches, listings
│   │   ├── demands/
│   │   │   ├── page.tsx                   # My demand requests list
│   │   │   ├── new/
│   │   │   │   └── page.tsx               # Multi-step create demand form
│   │   │   └── [id]/
│   │   │       └── page.tsx               # Demand detail + match list
│   │   ├── listings/
│   │   │   ├── page.tsx                   # My listings list
│   │   │   ├── new/
│   │   │   │   └── page.tsx               # Multi-step create listing form (with photo upload)
│   │   │   └── [id]/
│   │   │       └── page.tsx               # Listing detail + match list
│   │   ├── matches/
│   │   │   └── [id]/
│   │   │       └── page.tsx               # Match detail with score breakdown
│   │   ├── conversations/
│   │   │   ├── page.tsx                   # Inbox (conversation list)
│   │   │   └── [id]/
│   │   │       └── page.tsx               # Conversation thread (3-stage UI)
│   │   ├── orders/
│   │   │   ├── page.tsx                   # My orders list
│   │   │   └── [id]/
│   │   │       └── page.tsx               # Order detail with timeline + confirm button
│   │   ├── profile/
│   │   │   ├── page.tsx                   # My profile + ratings + listings + demands
│   │   │   └── set-password/
│   │   │       └── page.tsx               # Set password before sign-out
│   │   └── notifications/
│   │       └── page.tsx                   # Notification list
│   │
│   └── api/                               # Next.js Route Handlers (proxy to NestJS)
│       └── auth/
│           ├── magic-link/route.ts        # POST — proxies to NestJS POST /auth/magic-link
│           ├── set-password/route.ts      # POST — reads httpOnly cookie, proxies to NestJS
│           └── set-cookie/route.ts        # GET — sets access_token cookie from query param
│
├── auth/                                  # Auth redirect pages (not API routes)
│   ├── callback/
│   │   └── page.tsx                       # GET /auth/callback?token= — exchange for JWT
│   ├── logout/
│   │   └── page.tsx                       # Clears access_token cookie, redirects to /login
│   └── set-cookie/
│       └── route.ts                       # Sets the cookie after magic link verification
│
├── components/
│   ├── ui/                                # shadcn/ui base components (auto-generated)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── badge.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── sheet.tsx                      # Bottom sheet / drawer
│   │   └── ...
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   └── OnboardingForm.tsx
│   ├── demands/
│   │   ├── DemandForm.tsx                 # Multi-step form (3 steps)
│   │   ├── DemandCard.tsx                 # Compact card for lists
│   │   ├── DemandDetail.tsx               # Full detail view
│   │   └── DemandMatchList.tsx            # Matches linked to a demand
│   ├── listings/
│   │   ├── ListingForm.tsx                # Multi-step form (3 steps)
│   │   ├── ListingCard.tsx
│   │   ├── ListingDetail.tsx
│   │   └── ProofAssetUploader.tsx         # Drag-drop + preview + quality indicator
│   ├── matches/
│   │   ├── MatchCard.tsx                  # Row in a match list
│   │   └── MatchScoreBreakdown.tsx        # Score bars for 5 dimensions
│   ├── conversations/
│   │   ├── ConversationThread.tsx         # Container for the full thread page
│   │   ├── StageIndicator.tsx             # 3-step progress bar
│   │   ├── MatchSummaryBanner.tsx         # Side-by-side demand vs listing
│   │   ├── ProofAssetGallery.tsx          # Lightbox grid of proof photos
│   │   ├── EvidenceRequestList.tsx
│   │   ├── EvidenceRequestCard.tsx
│   │   ├── EvidenceRequestForm.tsx        # Bottom sheet form for creating requests
│   │   ├── MessageThread.tsx              # Scrollable message list (polling)
│   │   ├── MessageBubble.tsx
│   │   ├── MessageInput.tsx               # Disabled in verification stage
│   │   └── StageActions.tsx               # Stage-aware action buttons at bottom
│   ├── offers/
│   │   ├── OfferForm.tsx                  # Create/counter offer bottom sheet
│   │   └── OfferCard.tsx                  # Active offer display with actions
│   ├── orders/
│   │   ├── OrderCard.tsx
│   │   ├── OrderTimeline.tsx              # Vertical status stepper
│   │   └── ReviewForm.tsx                 # Post-order review bottom sheet
│   └── shared/
│       ├── StatusBadge.tsx                # Color-coded status pill (11 variants)
│       ├── TrustTierBadge.tsx             # new / established / trusted chip
│       ├── MatchScore.tsx                 # Stacked score pill + confidence label
│       └── SkeletonCard.tsx               # Loading skeleton (animate-pulse)
│
├── lib/
│   ├── api.ts                             # Typed fetch helpers (calls NestJS at NEXT_PUBLIC_API_URL)
│   ├── auth.ts                            # requireAuthOrRedirect() — server component helper
│   └── utils.ts                           # cn() and other utilities
│
├── hooks/
│   ├── useConversationMessages.ts         # TanStack Query — poll every 4s
│   ├── useNotifications.ts               # TanStack Query — refetch on focus
│   └── useMatches.ts                     # TanStack Query — match list
│
├── emails/                                # React Email templates (rendered server-side by NestJS)
│   ├── MagicLink.tsx
│   ├── MatchFound.tsx
│   ├── EvidenceRequested.tsx
│   ├── OfferReceived.tsx
│   ├── OrderCreated.tsx
│   └── InactivityWarning.tsx
│
├── types/
│   └── index.ts                           # Shared TypeScript types (mirrors Prisma output types)
│
├── proxy.ts                               # Auth guard — checks access_token cookie
├── .env.local                             # NEXT_PUBLIC_API_URL only
├── .env.example                           # Committed template
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## EC → Next.js Screen Mapping

| EC screen file | Next.js App Router path | Status |
|---------------|------------------------|--------|
| `screens/auth/login.tsx` | `app/(auth)/login/page.tsx` | Implemented (3-state: email/password/sent) |
| `screens/auth/magic-link-sent.tsx` | `app/(auth)/login/page.tsx` (sent state) | Merged into login page |
| `screens/auth/onboarding.tsx` | `app/(auth)/onboarding/page.tsx` | Full implementation in EC |
| `screens/home/home.tsx` | `app/(main)/page.tsx` | Full implementation in EC |
| `screens/demands/demands-screen.tsx` | `app/(main)/demands/page.tsx` | Stub — needs full list |
| `screens/demands/create-demand.tsx` | `app/(main)/demands/new/page.tsx` | Full 3-step form in EC |
| `screens/demands/demand-detail.tsx` | `app/(main)/demands/[id]/page.tsx` | Full implementation in EC |
| `screens/listings/listings-screen.tsx` | `app/(main)/listings/page.tsx` | Stub — needs full list |
| `screens/listings/create-listing.tsx` | `app/(main)/listings/new/page.tsx` | Stub only |
| `screens/listings/listing-detail.tsx` | `app/(main)/listings/[id]/page.tsx` | Stub only |
| `screens/matches/match-detail.tsx` | `app/(main)/matches/[id]/page.tsx` | Full implementation in EC |
| `screens/conversations/conversation-list.tsx` | `app/(main)/conversations/page.tsx` | Full implementation in EC |
| `screens/conversations/conversation-thread.tsx` | `app/(main)/conversations/[id]/page.tsx` | Full implementation in EC |
| `screens/orders/order-detail.tsx` | `app/(main)/orders/[id]/page.tsx` | Stub only |
| `screens/profile/profile.tsx` | `app/(main)/profile/page.tsx` | Implemented (with set-password flow) |
| `screens/notifications/notifications.tsx` | `app/(main)/notifications/page.tsx` | Full implementation in EC |

EC screens marked "stub only" have placeholder content — implement using the component hierarchies in [components.md](components.md).

---

## Key Naming Conventions

| Convention | Example |
|-----------|---------|
| Pages: lowercase, kebab-case folder | `app/(main)/demands/new/page.tsx` |
| Components: PascalCase | `DemandCard.tsx`, `StageIndicator.tsx` |
| Hooks: camelCase, `use` prefix | `useConversationMessages.ts` |
| Route handlers: always `route.ts` | `app/api/auth/set-password/route.ts` |
| Lib utilities: camelCase | `lib/auth.ts` |
| Zod schemas: `Schema` suffix | `CreateDemandSchema` |

---

## Route Groups

`(auth)` and `(main)` are Next.js route groups — they control which layout wraps the pages without affecting the URL path.

- `(auth)` pages render without the bottom navigation shell.
- `(main)` pages render with the navigation layout defined in `app/(main)/layout.tsx`.
- `(admin)` is a separate route group with no bottom nav. The `/admin` page guards itself — fetches `/auth/me` on mount and redirects to `/` if `isAdmin` is false.

## Bottom Navigation (5 tabs)

```
Home  |  Demands  |  Listings  |  Chats  |  Profile
  /       /demands   /listings  /conversations  /profile
```
