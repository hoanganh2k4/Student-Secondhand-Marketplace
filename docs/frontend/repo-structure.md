# Repository Structure (Frontend)

> Framework: Next.js 14 App Router
> Language: TypeScript throughout
> Single repo — frontend pages, API routes, shared lib all live together.
> Design reference: `EC/src.zip` — Vite/React Router prototype; screen names map 1-to-1 to Next.js pages below.

---

## Full Directory Tree

```
student-marketplace/
├── app/                                    # Next.js App Router root
│   ├── (auth)/                             # Unauthenticated routes (no layout shell)
│   │   ├── login/
│   │   │   └── page.tsx                   # Magic link login form
│   │   └── verify/
│   │       └── page.tsx                   # "Check your inbox" screen
│   │
│   ├── (main)/                             # Authenticated routes (with nav shell)
│   │   ├── layout.tsx                     # Bottom nav bar + notification bell
│   │   ├── page.tsx                       # Home "/" — active demands, recent matches, listings (EC: home.tsx)
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
│   │   │   └── page.tsx                   # My profile + ratings + listings + demands
│   │   └── admin/
│   │       ├── layout.tsx                 # Admin-only guard (redirect if not admin)
│   │       ├── page.tsx                   # Admin overview dashboard
│   │       ├── disputes/
│   │       │   ├── page.tsx               # Disputes list
│   │       │   └── [id]/page.tsx          # Dispute resolution view
│   │       ├── listings/
│   │       │   └── page.tsx               # Flag queue for listings
│   │       └── users/
│   │           └── page.tsx               # User management
│   │
│   └── api/                               # API routes (server-only)
│       ├── auth/[...supabase]/route.ts    # Supabase Auth callback handler
│       ├── demands/
│       │   ├── route.ts                   # POST /api/demands
│       │   └── [id]/route.ts              # GET, PATCH, DELETE
│       ├── listings/
│       │   ├── route.ts                   # POST /api/listings
│       │   └── [id]/
│       │       ├── route.ts               # GET, PATCH, DELETE
│       │       └── publish/route.ts       # POST — draft → active
│       ├── matches/
│       │   └── [id]/
│       │       ├── route.ts               # GET
│       │       ├── acknowledge/route.ts   # POST
│       │       └── decline/route.ts      # POST
│       ├── conversations/
│       │   ├── route.ts                   # GET (inbox list)
│       │   └── [id]/
│       │       ├── route.ts               # GET
│       │       ├── messages/route.ts      # POST
│       │       ├── advance-stage/route.ts # POST
│       │       ├── evidence-requests/
│       │       │   ├── route.ts           # POST (create)
│       │       │   └── [erId]/route.ts    # PATCH (fulfill / reject)
│       │       └── offers/route.ts        # POST (create offer)
│       ├── offers/
│       │   └── [id]/
│       │       ├── accept/route.ts
│       │       ├── reject/route.ts
│       │       └── counter/route.ts
│       ├── orders/
│       │   ├── route.ts                   # GET (list)
│       │   └── [id]/
│       │       ├── route.ts               # GET
│       │       ├── confirm/route.ts       # POST
│       │       ├── cancel/route.ts        # POST
│       │       ├── dispute/route.ts       # POST
│       │       └── review/route.ts        # POST
│       ├── upload/route.ts                # POST — proof asset upload
│       └── admin/
│           ├── disputes/[id]/resolve/route.ts
│           ├── users/[id]/suspend/route.ts
│           ├── users/[id]/ban/route.ts
│           └── listings/[id]/remove/route.ts
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
│   │   ├── MessageThread.tsx              # Scrollable message list (real-time)
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
│   ├── supabase/
│   │   ├── client.ts                      # createBrowserClient (client components)
│   │   ├── server.ts                      # createServerClient (server components, API routes)
│   │   └── admin.ts                       # Service role client (admin ops, storage)
│   ├── prisma.ts                          # Prisma client singleton
│   ├── matching/
│   │   ├── engine.ts
│   │   ├── normalizer.ts
│   │   └── weights.ts
│   ├── state-machines/
│   │   ├── demand.ts
│   │   ├── listing.ts
│   │   ├── match.ts
│   │   ├── conversation.ts
│   │   ├── offer.ts
│   │   └── order.ts
│   ├── notifications/
│   │   └── sender.ts
│   ├── validators/
│   │   ├── demand.ts                      # Zod schemas
│   │   ├── listing.ts
│   │   ├── offer.ts
│   │   └── upload.ts
│   └── utils/
│       ├── auth.ts                        # requireAuth helper
│       └── errors.ts                      # Shared error formatting
│
├── hooks/
│   ├── useConversationMessages.ts         # Supabase Realtime — message subscription
│   ├── useNotifications.ts               # Supabase Realtime — notification badge
│   └── useMatches.ts                     # TanStack Query — match list
│
├── emails/                                # React Email templates
│   ├── MatchFound.tsx
│   ├── EvidenceRequested.tsx
│   ├── EvidenceFulfilled.tsx
│   ├── OfferReceived.tsx
│   ├── OfferAccepted.tsx
│   ├── OfferRejected.tsx
│   ├── OrderCreated.tsx
│   ├── CompletionPrompt.tsx
│   └── InactivityWarning.tsx
│
├── types/
│   └── index.ts                           # Shared TypeScript types (mirrors Prisma output types)
│
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts                            # Seed categories
│   └── migrations/
│
├── supabase/
│   └── functions/
│       ├── expire-demands/index.ts
│       ├── expire-listings/index.ts
│       ├── expire-offers/index.ts
│       └── close-inactive-conversations/index.ts
│
├── middleware.ts                          # Auth guard + domain check
├── .env.local                             # Local environment variables
├── .env.example                           # Committed template (no secrets)
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## EC → Next.js Screen Mapping

| EC screen file | Next.js App Router path | Status |
|---------------|------------------------|--------|
| `screens/auth/login.tsx` | `app/(auth)/login/page.tsx` | Full implementation in EC |
| `screens/auth/magic-link-sent.tsx` | `app/(auth)/verify/page.tsx` | Full implementation in EC |
| `screens/auth/onboarding.tsx` | `app/(auth)/onboarding/page.tsx` | Full implementation in EC |
| `screens/home/home.tsx` | `app/(main)/page.tsx` | Full implementation in EC |
| `screens/demands/demands-screen.tsx` | `app/(main)/demands/page.tsx` | Stub only — needs full list |
| `screens/demands/create-demand.tsx` | `app/(main)/demands/new/page.tsx` | Full 3-step form in EC |
| `screens/demands/demand-detail.tsx` | `app/(main)/demands/[id]/page.tsx` | Full implementation in EC |
| `screens/listings/listings-screen.tsx` | `app/(main)/listings/page.tsx` | Stub only — needs full list |
| `screens/listings/create-listing.tsx` | `app/(main)/listings/new/page.tsx` | Stub only |
| `screens/listings/listing-detail.tsx` | `app/(main)/listings/[id]/page.tsx` | Stub only |
| `screens/matches/match-detail.tsx` | `app/(main)/matches/[id]/page.tsx` | Full implementation in EC |
| `screens/conversations/conversation-list.tsx` | `app/(main)/conversations/page.tsx` | Full implementation in EC |
| `screens/conversations/conversation-thread.tsx` | `app/(main)/conversations/[id]/page.tsx` | Full implementation in EC |
| `screens/orders/order-detail.tsx` | `app/(main)/orders/[id]/page.tsx` | Stub only |
| `screens/profile/profile.tsx` | `app/(main)/profile/page.tsx` | Full implementation in EC |
| `screens/notifications/notifications.tsx` | `app/(main)/notifications/page.tsx` | Full implementation in EC |

EC screens marked "stub only" have placeholder content — implement using the component hierarchies in [components.md](components.md).

---

## Key Naming Conventions

| Convention | Example |
|-----------|---------|
| Pages: lowercase, kebab-case folder | `app/(main)/demands/new/page.tsx` |
| Components: PascalCase | `DemandCard.tsx`, `StageIndicator.tsx` |
| Hooks: camelCase, `use` prefix | `useConversationMessages.ts` |
| API routes: always `route.ts` | `app/api/demands/route.ts` |
| Lib utilities: camelCase | `lib/utils/auth.ts` |
| Zod schemas: `Schema` suffix | `CreateDemandSchema` |

---

## Route Groups

`(auth)` and `(main)` are Next.js route groups — they control which layout wraps the pages without affecting the URL path.

- `(auth)` pages render without the bottom navigation shell.
- `(main)` pages render with the navigation layout defined in `app/(main)/layout.tsx`.
- `admin/` under `(main)` has its own nested layout that adds an admin sidebar guard.
