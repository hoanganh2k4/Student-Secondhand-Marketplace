# Student Secondhand Marketplace — Implementation Framework

> **Source of truth for all technical decisions has moved to [`docs/`](docs/README.md).**
> This file is kept for historical reference and high-level overview.
> For up-to-date details see: [docs/stack.md](docs/stack.md) · [docs/frontend/repo-structure.md](docs/frontend/repo-structure.md) · [docs/backend/schema.prisma.md](docs/backend/schema.prisma.md) · [docs/backend/matching-ai.md](docs/backend/matching-ai.md)

> This document defines the technical stack, architecture, project structure, and implementation patterns for the platform described in `rules.md`. It is scoped to MVP delivery.

---

## 1. Stack Decision

### Core Principle

Choose technologies that minimize operational complexity while supporting the full domain model (state machines, relational data, file uploads, real-time updates). For an MVP student startup, this means a managed-as-much-as-possible backend with a single primary language throughout.

### Chosen Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Framework | Next.js 14 (App Router, TypeScript) | Full-stack in one repo; API routes + frontend; large ecosystem |
| Database | PostgreSQL via Supabase | Managed, includes Auth, Storage, and Realtime out of the box |
| ORM | Prisma | Type-safe schema management; great migration tooling |
| Auth | Supabase Auth | Email magic link; university email domain restriction built-in |
| File Storage | Supabase Storage | Integrated with same platform; bucket policies per asset type |
| Email | Resend + React Email | Simple API; templates as React components |
| Real-time | Supabase Realtime | Postgres change-data-capture; no separate WebSocket server needed |
| UI Components | shadcn/ui + Tailwind CSS | Unstyled primitives; fast to customize; no licensing issues |
| State (client) | Zustand + TanStack Query | Zustand for UI state; TanStack Query for server state/caching |
| Matching Engine (rule-based) | Next.js API Route (synchronous) | Simple trigger on demand/listing creation; upgrade to queue later |
| Matching Engine (AI/semantic) | Python · FastAPI · PyTorch · FAISS · BM25 | Separate microservice; MultiStagePipeline; multilingual BiEncoder |
| Background Jobs | Supabase Edge Functions (cron) | Expiry jobs, inactivity auto-close; no separate worker server |
| Deployment | Vercel (app) + Supabase (backend) + Docker/VPS (AI service) | AI service needs persistent GPU/CPU host |

### What Is Explicitly Not Used in MVP

- Redis — not needed until rate limiting at scale; use DB-level counters for now.
- Separate WebSocket server — Supabase Realtime covers the MVP conversation case.
- Payment gateway — out of scope per `rules.md`.
- LLM API calls in hot path — replaced by local BiEncoder for latency + cost reasons.
- Separate job queue (Bull, Sidekiq) — Supabase cron edge functions cover expiry jobs.

---

## 2. Repository Structure

```
student-marketplace/
├── app/                          # Next.js App Router
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── verify/page.tsx
│   ├── (main)/
│   │   ├── layout.tsx            # Main shell with bottom nav bar
│   │   ├── page.tsx              # Home "/" — demands + matches + listings dashboard
│   │   ├── demands/
│   │   │   ├── page.tsx          # My demand requests list
│   │   │   ├── new/page.tsx      # Create demand form
│   │   │   └── [id]/page.tsx     # Demand detail + matches
│   │   ├── listings/
│   │   │   ├── page.tsx          # My listings list
│   │   │   ├── new/page.tsx      # Create listing form
│   │   │   └── [id]/page.tsx     # Listing detail + matches
│   │   ├── matches/
│   │   │   └── [id]/page.tsx     # Match detail
│   │   ├── conversations/
│   │   │   ├── page.tsx          # Inbox
│   │   │   └── [id]/page.tsx     # Conversation thread
│   │   ├── orders/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   └── admin/
│   │       ├── layout.tsx        # Admin-only guard
│   │       ├── disputes/page.tsx
│   │       ├── listings/page.tsx
│   │       └── users/page.tsx
│   └── api/
│       ├── auth/[...supabase]/route.ts
│       ├── demands/
│       │   ├── route.ts          # POST /api/demands
│       │   └── [id]/route.ts     # GET, PATCH, DELETE
│       ├── listings/
│       │   ├── route.ts
│       │   └── [id]/route.ts
│       ├── matches/
│       │   └── [id]/
│       │       ├── route.ts
│       │       └── acknowledge/route.ts
│       ├── conversations/
│       │   └── [id]/
│       │       ├── route.ts
│       │       ├── messages/route.ts
│       │       ├── evidence-requests/route.ts
│       │       ├── advance-stage/route.ts
│       │       └── offers/route.ts
│       ├── offers/
│       │   └── [id]/
│       │       ├── accept/route.ts
│       │       ├── reject/route.ts
│       │       └── counter/route.ts
│       ├── orders/
│       │   └── [id]/
│       │       ├── confirm/route.ts
│       │       └── dispute/route.ts
│       ├── upload/route.ts       # Proof asset upload handler
│       ├── matching/run/route.ts  # Internal: trigger matching
│       └── admin/
│           ├── disputes/[id]/resolve/route.ts
│           └── users/[id]/suspend/route.ts
├── components/
│   ├── ui/                       # shadcn/ui base components
│   ├── auth/
│   ├── demands/
│   │   ├── DemandForm.tsx
│   │   ├── DemandCard.tsx
│   │   └── DemandMatchList.tsx
│   ├── listings/
│   │   ├── ListingForm.tsx
│   │   ├── ListingCard.tsx
│   │   └── ProofAssetUploader.tsx
│   ├── conversations/
│   │   ├── ConversationThread.tsx
│   │   ├── StageIndicator.tsx
│   │   ├── EvidenceRequestCard.tsx
│   │   └── MessageBubble.tsx
│   ├── offers/
│   │   ├── OfferForm.tsx
│   │   └── OfferCard.tsx
│   └── shared/
│       ├── StatusBadge.tsx
│       └── TrustTierBadge.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Browser client
│   │   ├── server.ts             # Server client (cookies)
│   │   └── admin.ts              # Service role client (admin ops)
│   ├── prisma.ts                 # Prisma client singleton
│   ├── matching/
│   │   ├── engine.ts             # Core scoring logic
│   │   ├── normalizer.ts         # Input normalization
│   │   └── weights.ts            # Dimension weights config
│   ├── state-machines/
│   │   ├── demand.ts
│   │   ├── listing.ts
│   │   ├── match.ts
│   │   ├── conversation.ts
│   │   ├── offer.ts
│   │   └── order.ts
│   ├── notifications/
│   │   └── sender.ts             # Resend email dispatch
│   ├── validators/
│   │   ├── demand.ts             # Zod schemas
│   │   ├── listing.ts
│   │   └── offer.ts
│   └── utils/
│       ├── auth.ts               # getSession, requireAuth helpers
│       └── errors.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── emails/                       # React Email templates
│   ├── MatchFound.tsx
│   ├── EvidenceRequested.tsx
│   ├── OfferReceived.tsx
│   └── OrderCreated.tsx
├── hooks/
│   ├── useConversation.ts        # Supabase Realtime subscription
│   ├── useMatches.ts
│   └── useNotifications.ts
├── types/
│   └── index.ts                  # Shared TypeScript types (mirrors Prisma)
├── middleware.ts                  # Auth guard for protected routes
├── .env.local
└── supabase/
    └── functions/
        ├── expire-demands/index.ts
        ├── expire-listings/index.ts
        ├── expire-offers/index.ts
        └── close-inactive-conversations/index.ts
```

---

## 3. Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── ENUMS ────────────────────────────────────────────────────────────────

enum UserStatus {
  active
  suspended
  banned
}

enum VerificationStatus {
  unverified
  email_verified
  id_verified
}

enum TrustTier {
  new
  established
  trusted
}

enum ItemCondition {
  poor
  fair
  good
  very_good
  like_new
}

enum Urgency {
  flexible
  within_week
  within_month
}

enum DemandStatus {
  draft
  active
  waiting
  matched
  in_conversation
  in_negotiation
  fulfilled
  expired
  cancelled
}

enum ListingStatus {
  draft
  active
  matched
  in_conversation
  partially_sold
  sold
  expired
  removed
}

enum MatchConfidence {
  high
  medium
  low
}

enum MatchStatus {
  proposed
  buyer_confirmed
  seller_confirmed
  active
  closed_success
  closed_failed
  expired
}

enum ConversationStage {
  verification
  clarification
  negotiation
  closed
}

enum ConversationStatus {
  active
  closed
}

enum CloseReason {
  completed
  abandoned
  expired
  admin_closed
}

enum EvidenceRequestType {
  additional_photo
  video
  measurement
  document
  live_demo
}

enum EvidenceRequestStatus {
  pending
  fulfilled
  rejected
  expired
}

enum FulfillmentMethod {
  pickup
  delivery
  flexible
}

enum OfferStatus {
  draft
  pending
  countered
  accepted
  rejected
  expired
  cancelled
}

enum OrderStatus {
  created
  confirmed
  in_progress
  completed
  cancelled
  disputed
}

enum DisputeType {
  item_not_as_described
  no_show
  fake_proof
  other
}

enum DisputeStatus {
  opened
  under_review
  resolved
  closed
}

enum DisputeResolution {
  resolved_for_buyer
  resolved_for_seller
  mutual
  dismissed
}

enum MessageType {
  text
  system
  evidence_request
  offer_notification
}

enum AssetContext {
  initial_listing
  evidence_response
  demand_reference
}

enum AssetType {
  photo
  video
  document
}

enum ReviewRole {
  buyer
  seller
}

// ─── IDENTITY ─────────────────────────────────────────────────────────────

model User {
  id           String     @id @default(uuid())
  email        String     @unique
  emailVerified Boolean   @default(false) @map("email_verified")
  name         String
  phone        String?
  status       UserStatus @default(active)
  createdAt    DateTime   @default(now()) @map("created_at")
  lastActiveAt DateTime?  @map("last_active_at")

  studentProfile  StudentProfile?
  buyerProfile    BuyerProfile?
  sellerProfile   SellerProfile?
  notifications   Notification[]
  uploadedAssets  ProofAsset[]
  sentMessages    Message[]
  filedDisputes   Dispute[]       @relation("DisputeFiler")
  assignedDisputes Dispute[]      @relation("DisputeAdmin")

  buyerConversations  Conversation[] @relation("BuyerConversation")
  sellerConversations Conversation[] @relation("SellerConversation")
  buyerOrders         Order[]        @relation("BuyerOrder")
  sellerOrders        Order[]        @relation("SellerOrder")
  reviewsGiven        RatingReview[] @relation("Reviewer")
  reviewsReceived     RatingReview[] @relation("Reviewed")
  evidenceRequests    EvidenceRequest[]
  offersCreated       Offer[]

  @@map("users")
}

model StudentProfile {
  id                 String             @id @default(uuid())
  userId             String             @unique @map("user_id")
  university         String
  studentIdNumber    String?            @map("student_id_number")
  studentIdAssetId   String?            @map("student_id_asset_id")
  verificationStatus VerificationStatus @default(unverified) @map("verification_status")
  verifiedAt         DateTime?          @map("verified_at")
  graduationYear     Int?               @map("graduation_year")

  user User @relation(fields: [userId], references: [id])

  @@map("student_profiles")
}

model BuyerProfile {
  id                   String    @id @default(uuid())
  userId               String    @unique @map("user_id")
  preferredCategories  String[]  @map("preferred_categories")
  defaultLocation      String?   @map("default_location")
  buyerRating          Decimal?  @map("buyer_rating") @db.Decimal(3, 2)
  totalOrdersCompleted Int       @default(0) @map("total_orders_completed")
  trustTier            TrustTier @default(new) @map("trust_tier")

  user           User            @relation(fields: [userId], references: [id])
  demandRequests DemandRequest[]

  @@map("buyer_profiles")
}

model SellerProfile {
  id                   String    @id @default(uuid())
  userId               String    @unique @map("user_id")
  sellerRating         Decimal?  @map("seller_rating") @db.Decimal(3, 2)
  totalListingsCreated Int       @default(0) @map("total_listings_created")
  totalOrdersCompleted Int       @default(0) @map("total_orders_completed")
  trustTier            TrustTier @default(new) @map("trust_tier")
  preferredMeetupZones String[]  @map("preferred_meetup_zones")
  availabilityNotes    String?   @map("availability_notes")

  user            User             @relation(fields: [userId], references: [id])
  productListings ProductListing[]

  @@map("seller_profiles")
}

// ─── TAXONOMY ─────────────────────────────────────────────────────────────

model Category {
  id                 String     @id @default(uuid())
  name               String
  parentId           String?    @map("parent_id")
  proofRequirements  Json?      @map("proof_requirements")
  matchingAttributes Json?      @map("matching_attributes")
  isActive           Boolean    @default(true) @map("is_active")

  parent   Category?  @relation("CategoryHierarchy", fields: [parentId], references: [id])
  children Category[] @relation("CategoryHierarchy")

  demandRequests  DemandRequest[]  @relation("DemandCategory")
  demandSubs      DemandRequest[]  @relation("DemandSubcategory")
  listingCategories ProductListing[] @relation("ListingCategory")
  listingSubcategories ProductListing[] @relation("ListingSubcategory")

  @@map("categories")
}

// ─── SUPPLY AND DEMAND ────────────────────────────────────────────────────

model DemandRequest {
  id                  String        @id @default(uuid())
  buyerProfileId      String        @map("buyer_profile_id")
  title               String
  categoryId          String        @map("category_id")
  subcategoryId       String?       @map("subcategory_id")
  description         String?
  budgetMin           Decimal       @map("budget_min") @db.Decimal(10, 2)
  budgetMax           Decimal       @map("budget_max") @db.Decimal(10, 2)
  preferredCondition  ItemCondition @default(good) @map("preferred_condition")
  quantityNeeded      Int           @default(1) @map("quantity_needed")
  fulfilledQuantity   Int           @default(0) @map("fulfilled_quantity")
  location            String?
  urgency             Urgency       @default(flexible)
  specialRequirements String?       @map("special_requirements")
  status              DemandStatus  @default(draft)
  expiresAt           DateTime      @map("expires_at")
  createdAt           DateTime      @default(now()) @map("created_at")

  buyerProfile BuyerProfile @relation(fields: [buyerProfileId], references: [id])
  category     Category     @relation("DemandCategory", fields: [categoryId], references: [id])
  subcategory  Category?    @relation("DemandSubcategory", fields: [subcategoryId], references: [id])
  matches      Match[]

  @@map("demand_requests")
}

model ProductListing {
  id                    String        @id @default(uuid())
  sellerProfileId       String        @map("seller_profile_id")
  title                 String
  categoryId            String        @map("category_id")
  subcategoryId         String?       @map("subcategory_id")
  description           String?
  condition             ItemCondition
  conditionNotes        String?       @map("condition_notes")
  quantityAvailable     Int           @map("quantity_available")
  quantityRemaining     Int           @map("quantity_remaining")
  priceExpectation      Decimal       @map("price_expectation") @db.Decimal(10, 2)
  priceFlexible         Boolean       @default(false) @map("price_flexible")
  location              String?
  availabilityWindow    String?       @map("availability_window")
  status                ListingStatus @default(draft)
  proofCompletenessScore Int          @default(0) @map("proof_completeness_score")
  expiresAt             DateTime      @map("expires_at")
  createdAt             DateTime      @default(now()) @map("created_at")

  sellerProfile SellerProfile @relation(fields: [sellerProfileId], references: [id])
  category      Category      @relation("ListingCategory", fields: [categoryId], references: [id])
  subcategory   Category?     @relation("ListingSubcategory", fields: [subcategoryId], references: [id])
  proofAssets   ProofAsset[]
  matches       Match[]

  @@map("product_listings")
}

// ─── PROOF ────────────────────────────────────────────────────────────────

model ProofAsset {
  id                String       @id @default(uuid())
  uploaderUserId    String       @map("uploader_user_id")
  assetType         AssetType    @map("asset_type")
  fileUrl           String       @map("file_url")
  thumbnailUrl      String?      @map("thumbnail_url")
  context           AssetContext
  parentListingId   String?      @map("parent_listing_id")
  parentDemandId    String?      @map("parent_demand_id")
  evidenceRequestId String?      @map("evidence_request_id")
  qualityScore      Int?         @map("quality_score")
  flagged           Boolean      @default(false)
  createdAt         DateTime     @default(now()) @map("created_at")

  uploader        User             @relation(fields: [uploaderUserId], references: [id])
  parentListing   ProductListing?  @relation(fields: [parentListingId], references: [id])
  evidenceRequest EvidenceRequest? @relation(fields: [evidenceRequestId], references: [id])

  @@map("proof_assets")
}

// ─── MATCHING ─────────────────────────────────────────────────────────────

model Match {
  id               String          @id @default(uuid())
  demandRequestId  String          @map("demand_request_id")
  productListingId String          @map("product_listing_id")
  matchScore       Int             @map("match_score")
  matchConfidence  MatchConfidence @map("match_confidence")
  scoreBreakdown   Json            @map("score_breakdown")
  missingInfoFlags String[]        @map("missing_info_flags")
  status           MatchStatus     @default(proposed)
  buyerAcknowledged Boolean        @default(false) @map("buyer_acknowledged")
  sellerAcknowledged Boolean       @default(false) @map("seller_acknowledged")
  createdAt        DateTime        @default(now()) @map("created_at")

  demandRequest  DemandRequest  @relation(fields: [demandRequestId], references: [id])
  productListing ProductListing @relation(fields: [productListingId], references: [id])
  conversation   Conversation?
  offers         Offer[]
  orders         Order[]

  @@unique([demandRequestId, productListingId])
  @@map("matches")
}

// ─── CONVERSATION ─────────────────────────────────────────────────────────

model Conversation {
  id             String             @id @default(uuid())
  matchId        String             @unique @map("match_id")
  buyerUserId    String             @map("buyer_user_id")
  sellerUserId   String             @map("seller_user_id")
  stage          ConversationStage  @default(verification)
  stageEnteredAt DateTime           @default(now()) @map("stage_entered_at")
  lastActivityAt DateTime           @default(now()) @map("last_activity_at")
  autoCloseAt    DateTime           @map("auto_close_at")
  status         ConversationStatus @default(active)
  closeReason    CloseReason?       @map("close_reason")

  match            Match             @relation(fields: [matchId], references: [id])
  buyer            User              @relation("BuyerConversation", fields: [buyerUserId], references: [id])
  seller           User              @relation("SellerConversation", fields: [sellerUserId], references: [id])
  messages         Message[]
  evidenceRequests EvidenceRequest[]
  offers           Offer[]

  @@map("conversations")
}

model Message {
  id               String      @id @default(uuid())
  conversationId   String      @map("conversation_id")
  senderUserId     String      @map("sender_user_id")
  messageType      MessageType @map("message_type")
  body             String
  isSystemGenerated Boolean    @default(false) @map("is_system_generated")
  createdAt        DateTime    @default(now()) @map("created_at")

  conversation Conversation @relation(fields: [conversationId], references: [id])
  sender       User         @relation(fields: [senderUserId], references: [id])

  @@map("messages")
}

model EvidenceRequest {
  id               String                @id @default(uuid())
  conversationId   String                @map("conversation_id")
  requesterUserId  String                @map("requester_user_id")
  requestType      EvidenceRequestType   @map("request_type")
  description      String
  status           EvidenceRequestStatus @default(pending)
  dueAt            DateTime              @map("due_at")
  fulfilledAt      DateTime?             @map("fulfilled_at")
  rejectionReason  String?               @map("rejection_reason")

  conversation Conversation @relation(fields: [conversationId], references: [id])
  requester    User         @relation(fields: [requesterUserId], references: [id])
  proofAssets  ProofAsset[]

  @@map("evidence_requests")
}

// ─── TRANSACTION ──────────────────────────────────────────────────────────

model Offer {
  id               String            @id @default(uuid())
  conversationId   String            @map("conversation_id")
  createdByUserId  String            @map("created_by_user_id")
  matchId          String            @map("match_id")
  quantity         Int
  proposedPrice    Decimal           @map("proposed_price") @db.Decimal(10, 2)
  totalPrice       Decimal           @map("total_price") @db.Decimal(10, 2)
  fulfillmentMethod FulfillmentMethod @map("fulfillment_method")
  meetupLocation   String?           @map("meetup_location")
  meetupTime       DateTime?         @map("meetup_time")
  termsNotes       String?           @map("terms_notes")
  proofSnapshot    Json?             @map("proof_snapshot")
  parentOfferId    String?           @map("parent_offer_id")
  counterOfferId   String?           @map("counter_offer_id")
  status           OfferStatus       @default(draft)
  expiresAt        DateTime          @map("expires_at")
  createdAt        DateTime          @default(now()) @map("created_at")

  conversation  Conversation @relation(fields: [conversationId], references: [id])
  createdBy     User         @relation(fields: [createdByUserId], references: [id])
  match         Match        @relation(fields: [matchId], references: [id])
  parentOffer   Offer?       @relation("OfferChain", fields: [parentOfferId], references: [id])
  childOffers   Offer[]      @relation("OfferChain")
  order         Order?

  @@map("offers")
}

model Order {
  id                      String      @id @default(uuid())
  offerId                 String      @unique @map("offer_id")
  matchId                 String      @map("match_id")
  buyerUserId             String      @map("buyer_user_id")
  sellerUserId            String      @map("seller_user_id")
  quantity                Int
  finalPrice              Decimal     @map("final_price") @db.Decimal(10, 2)
  fulfillmentMethod       String      @map("fulfillment_method")
  meetupDetails           String?     @map("meetup_details")
  proofSnapshot           Json?       @map("proof_snapshot")
  status                  OrderStatus @default(created)
  buyerConfirmedComplete  Boolean     @default(false) @map("buyer_confirmed_complete")
  sellerConfirmedComplete Boolean     @default(false) @map("seller_confirmed_complete")
  completedAt             DateTime?   @map("completed_at")
  createdAt               DateTime    @default(now()) @map("created_at")
  cancelledAt             DateTime?   @map("cancelled_at")
  cancellationReason      String?     @map("cancellation_reason")

  offer         Offer          @relation(fields: [offerId], references: [id])
  match         Match          @relation(fields: [matchId], references: [id])
  buyer         User           @relation("BuyerOrder", fields: [buyerUserId], references: [id])
  seller        User           @relation("SellerOrder", fields: [sellerUserId], references: [id])
  ratingReviews RatingReview[]
  dispute       Dispute?

  @@map("orders")
}

// ─── POST-TRANSACTION ─────────────────────────────────────────────────────

model RatingReview {
  id               String     @id @default(uuid())
  orderId          String     @map("order_id")
  reviewerUserId   String     @map("reviewer_user_id")
  reviewedUserId   String     @map("reviewed_user_id")
  roleOfReviewer   ReviewRole @map("role_of_reviewer")
  rating           Int
  comment          String?
  createdAt        DateTime   @default(now()) @map("created_at")

  order    Order @relation(fields: [orderId], references: [id])
  reviewer User  @relation("Reviewer", fields: [reviewerUserId], references: [id])
  reviewed User  @relation("Reviewed", fields: [reviewedUserId], references: [id])

  @@unique([orderId, roleOfReviewer])
  @@map("rating_reviews")
}

model Dispute {
  id               String            @id @default(uuid())
  orderId          String            @unique @map("order_id")
  filedByUserId    String            @map("filed_by_user_id")
  disputeType      DisputeType       @map("dispute_type")
  description      String
  evidenceAssets   String[]          @map("evidence_assets")
  status           DisputeStatus     @default(opened)
  assignedAdminId  String?           @map("assigned_admin_id")
  resolution       DisputeResolution?
  resolutionNotes  String?           @map("resolution_notes")
  openedAt         DateTime          @default(now()) @map("opened_at")
  resolvedAt       DateTime?         @map("resolved_at")

  order         Order @relation(fields: [orderId], references: [id])
  filedBy       User  @relation("DisputeFiler", fields: [filedByUserId], references: [id])
  assignedAdmin User? @relation("DisputeAdmin", fields: [assignedAdminId], references: [id])

  @@map("disputes")
}

// ─── SYSTEM ───────────────────────────────────────────────────────────────

model Notification {
  id            String   @id @default(uuid())
  userId        String   @map("user_id")
  type          String
  referenceType String?  @map("reference_type")
  referenceId   String?  @map("reference_id")
  body          String
  read          Boolean  @default(false)
  createdAt     DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id])

  @@map("notifications")
}
```

---

## 4. Authentication and Authorization

### University Email Restriction

Supabase Auth is configured to restrict signups to allowed email domains. This is enforced at two levels:

**Level 1 — Supabase Auth hook (signup):** A `before_user_created` hook validates the email domain against an `allowed_domains` table before the account is created.

**Level 2 — Middleware:** `middleware.ts` checks `session.user.email` against the allowed domains list on every protected route. Redirects to `/login` if unauthenticated, and to `/verify` if email is not yet confirmed.

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

### Authorization Pattern for API Routes

Every API route uses a shared helper that extracts the session, fetches the user's profiles, and returns them for use in the handler. This avoids repeated boilerplate.

```typescript
// lib/utils/auth.ts
import { createServerClient } from '@supabase/ssr'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

export async function requireAuth() {
  const supabase = createServerClient(/* ... */)
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('UNAUTHORIZED')

  const user = await prisma.user.findUniqueOrThrow({
    where: { email: session.user.email! },
    include: { buyerProfile: true, sellerProfile: true }
  })
  return user
}
```

### Admin Guard

Admin routes are protected by checking `user.status === 'admin'` (add an `isAdmin` boolean field to User) in both the middleware and the API route handler. Admin operations use the Supabase service-role client (`lib/supabase/admin.ts`) when bypassing row-level security is needed.

---

## 5. Matching Engine Implementation

The matching engine lives in `lib/matching/engine.ts`. It is called synchronously from the API route after a listing or demand is created (MVP). The function runs a database query to fetch candidates, scores each one, and inserts Match records for scores ≥ 40.

### Normalizer

```typescript
// lib/matching/normalizer.ts

const CONDITION_SCALE: Record<string, number> = {
  poor: 1, fair: 2, good: 3, very_good: 4, like_new: 5
}

export function normalizeCondition(condition: string): number {
  return CONDITION_SCALE[condition] ?? 0
}

export function normalizePriceCompatibility(
  listingPrice: number,
  demandMin: number,
  demandMax: number
): number {
  if (listingPrice >= demandMin && listingPrice <= demandMax) return 1.0
  if (listingPrice > demandMax) {
    const overage = (listingPrice - demandMax) / demandMax
    if (overage <= 0.2) return 0.6
    if (overage <= 0.5) return 0.3
    return 0
  }
  // listing price below min: still a match (buyer might accept)
  return 0.8
}

export function normalizeCategoryMatch(
  listingCategoryId: string,
  listingSubcategoryId: string | null,
  demandCategoryId: string,
  demandSubcategoryId: string | null
): number {
  if (listingCategoryId !== demandCategoryId) return 0
  if (!demandSubcategoryId) return 1.0            // buyer didn't specify sub
  if (listingSubcategoryId === demandSubcategoryId) return 1.0
  if (listingSubcategoryId === null) return 0.6   // listing is broader
  return 0.3                                       // different subcategory, same parent
}

export function normalizeQuantity(
  quantityRemaining: number,
  quantityNeeded: number
): number {
  if (quantityRemaining >= quantityNeeded) return 1.0
  if (quantityRemaining > 0) return 0.5
  return 0
}
```

### Scoring Engine

```typescript
// lib/matching/engine.ts
import { prisma } from '@/lib/prisma'
import { WEIGHTS } from './weights'
import {
  normalizeCategoryMatch,
  normalizeCondition,
  normalizePriceCompatibility,
  normalizeQuantity,
} from './normalizer'

interface ScoreBreakdown {
  category: number
  price: number
  condition: number
  location: number
  quantity: number
}

function computeScore(breakdown: ScoreBreakdown): number {
  return Math.round(
    breakdown.category  * WEIGHTS.category  +
    breakdown.price     * WEIGHTS.price     +
    breakdown.condition * WEIGHTS.condition +
    breakdown.location  * WEIGHTS.location  +
    breakdown.quantity  * WEIGHTS.quantity
  )
}

function deriveConfidence(score: number) {
  if (score >= 80) return 'high'
  if (score >= 60) return 'medium'
  return 'low'
}

function detectMissingInfoFlags(
  breakdown: ScoreBreakdown,
  listing: any
): string[] {
  const flags: string[] = []
  if (breakdown.price     < 0.3)  flags.push('price_mismatch')
  if (breakdown.condition < 0.5)  flags.push('condition_below_requirement')
  if (breakdown.location  < 0.3)  flags.push('location_incompatible')
  if (breakdown.quantity  === 0.5) flags.push('quantity_partial')
  if (breakdown.category  < 0.7)  flags.push('category_approximate')
  if (listing.proofCompletenessScore < 50) flags.push('insufficient_proof')
  return flags
}

// Called when a DemandRequest is created or re-activated
export async function matchDemandAgainstListings(demandId: string) {
  const demand = await prisma.demandRequest.findUniqueOrThrow({
    where: { id: demandId }
  })

  const existingMatchListingIds = await prisma.match.findMany({
    where: { demandRequestId: demandId },
    select: { productListingId: true }
  }).then(ms => ms.map(m => m.productListingId))

  const candidates = await prisma.productListing.findMany({
    where: {
      status: 'active',
      categoryId: demand.categoryId,
      id: { notIn: existingMatchListingIds },
      quantityRemaining: { gt: 0 },
    },
    take: 50
  })

  const matchesToCreate = []

  for (const listing of candidates) {
    const breakdown: ScoreBreakdown = {
      category:  normalizeCategoryMatch(
                   listing.categoryId, listing.subcategoryId,
                   demand.categoryId, demand.subcategoryId
                 ) * 100,
      price:     normalizePriceCompatibility(
                   Number(listing.priceExpectation),
                   Number(demand.budgetMin),
                   Number(demand.budgetMax)
                 ) * 100,
      condition: (normalizeCondition(listing.condition) >=
                  normalizeCondition(demand.preferredCondition)
                   ? normalizeCondition(listing.condition) / 5
                   : Math.max(0, (normalizeCondition(listing.condition) -
                     normalizeCondition(demand.preferredCondition) + 5) / 10)
                 ) * 100,
      location:  listing.location === demand.location ? 100 : 50, // simplified for MVP
      quantity:  normalizeQuantity(listing.quantityRemaining, demand.quantityNeeded) * 100,
    }

    const score = computeScore(breakdown)
    if (score < 40) continue

    matchesToCreate.push({
      demandRequestId:  demand.id,
      productListingId: listing.id,
      matchScore:       score,
      matchConfidence:  deriveConfidence(score),
      scoreBreakdown:   breakdown,
      missingInfoFlags: detectMissingInfoFlags(breakdown, listing),
    })
  }

  if (matchesToCreate.length === 0) {
    await prisma.demandRequest.update({
      where: { id: demandId },
      data:  { status: 'waiting' }
    })
    return
  }

  await prisma.match.createMany({ data: matchesToCreate, skipDuplicates: true })
  await prisma.demandRequest.update({
    where: { id: demandId },
    data:  { status: 'matched' }
  })

  // Notify both sides for each new match
  // (notification logic omitted for brevity — see Section 9)
}

// Called when a ProductListing is created or re-activated
export async function matchListingAgainstDemands(listingId: string) {
  // Mirror of matchDemandAgainstListings with demand/listing swapped
}
```

### Weights Configuration

```typescript
// lib/matching/weights.ts
export const WEIGHTS = {
  category:  30,
  price:     25,
  condition: 20,
  location:  15,
  quantity:  10,
} as const
```

---

## 6. State Machine Implementation

State machines are implemented as pure functions with explicit transition tables. They are called from API route handlers before any database write. If a transition is invalid, the handler returns a 422 error.

```typescript
// lib/state-machines/offer.ts

type OfferStatus =
  | 'draft' | 'pending' | 'countered'
  | 'accepted' | 'rejected' | 'expired' | 'cancelled'

type OfferEvent =
  | 'SUBMIT' | 'ACCEPT' | 'REJECT' | 'COUNTER' | 'EXPIRE' | 'CANCEL'

const OFFER_TRANSITIONS: Record<OfferStatus, Partial<Record<OfferEvent, OfferStatus>>> = {
  draft:     { SUBMIT: 'pending' },
  pending:   { ACCEPT: 'accepted', REJECT: 'rejected', COUNTER: 'countered', EXPIRE: 'expired', CANCEL: 'cancelled' },
  countered: {},
  accepted:  {},
  rejected:  {},
  expired:   {},
  cancelled: {},
}

export function transitionOffer(current: OfferStatus, event: OfferEvent): OfferStatus {
  const next = OFFER_TRANSITIONS[current]?.[event]
  if (!next) {
    throw new Error(`Invalid offer transition: ${current} + ${event}`)
  }
  return next
}
```

Apply the same pattern to `DemandStatus`, `ListingStatus`, `MatchStatus`, `ConversationStage`, and `OrderStatus`. Each state machine module exports a single `transitionX(current, event)` function. API route handlers call it, get the next state, and write it to the database in one operation.

---

## 7. API Route Patterns

All API routes follow the same structure:

```typescript
// app/api/demands/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/utils/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { matchDemandAgainstListings } from '@/lib/matching/engine'

const CreateDemandSchema = z.object({
  title:              z.string().min(3).max(120),
  categoryId:         z.string().uuid(),
  subcategoryId:      z.string().uuid().optional(),
  description:        z.string().max(1000).optional(),
  budgetMin:          z.number().positive(),
  budgetMax:          z.number().positive(),
  preferredCondition: z.enum(['any', 'good', 'very_good', 'like_new']).default('good'),
  quantityNeeded:     z.number().int().min(1).default(1),
  location:           z.string().optional(),
  urgency:            z.enum(['flexible', 'within_week', 'within_month']).default('flexible'),
  specialRequirements: z.string().max(500).optional(),
}).refine(d => d.budgetMin <= d.budgetMax, {
  message: 'budgetMin must be ≤ budgetMax'
})

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()

    // Ensure BuyerProfile exists
    const buyerProfile = await prisma.buyerProfile.upsert({
      where:  { userId: user.id },
      create: { userId: user.id },
      update: {},
    })

    // Check active demand limit
    const activeCount = await prisma.demandRequest.count({
      where: { buyerProfileId: buyerProfile.id, status: { notIn: ['expired', 'cancelled', 'fulfilled'] } }
    })
    if (activeCount >= 10) {
      return NextResponse.json({ error: 'Active demand request limit reached (10)' }, { status: 422 })
    }

    const body = CreateDemandSchema.parse(await req.json())

    const demand = await prisma.demandRequest.create({
      data: {
        ...body,
        buyerProfileId: buyerProfile.id,
        status: 'active',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }
    })

    // Trigger matching asynchronously (fire and forget for MVP)
    matchDemandAgainstListings(demand.id).catch(console.error)

    return NextResponse.json(demand, { status: 201 })
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 })
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### Key API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/demands` | Create DemandRequest; triggers matching |
| GET | `/api/demands/[id]` | Get demand + matches |
| PATCH | `/api/demands/[id]` | Update demand (draft only) |
| DELETE | `/api/demands/[id]` | Cancel demand |
| POST | `/api/listings` | Create ProductListing; triggers matching |
| PATCH | `/api/listings/[id]` | Update listing (draft only) |
| POST | `/api/listings/[id]/publish` | Move draft → active after proof check |
| POST | `/api/matches/[id]/acknowledge` | Buyer or seller acknowledges a match |
| POST | `/api/matches/[id]/decline` | Buyer or seller declines a match |
| GET | `/api/conversations/[id]` | Get conversation + messages + evidence requests |
| POST | `/api/conversations/[id]/messages` | Send a message |
| POST | `/api/conversations/[id]/evidence-requests` | Buyer creates EvidenceRequest |
| PATCH | `/api/conversations/[id]/evidence-requests/[erId]` | Seller fulfills or rejects |
| POST | `/api/conversations/[id]/advance-stage` | Buyer advances verification → clarification |
| POST | `/api/conversations/[id]/offers` | Create an Offer |
| POST | `/api/offers/[id]/accept` | Accept offer; creates Order |
| POST | `/api/offers/[id]/reject` | Reject offer |
| POST | `/api/offers/[id]/counter` | Create counter-offer |
| POST | `/api/orders/[id]/confirm` | Buyer or seller confirms completion |
| POST | `/api/orders/[id]/dispute` | File a Dispute |
| POST | `/api/upload` | Upload ProofAsset to Supabase Storage |

---

## 8. File Upload and Proof Asset Management

All proof uploads go through a single endpoint that:

1. Validates the file type (image/jpeg, image/png, image/webp, video/mp4).
2. Enforces size limits (photos: 10 MB, videos: 50 MB).
3. Uploads to Supabase Storage.
4. Runs a basic quality check (image dimensions; flag if < 400×400).
5. Creates a `ProofAsset` record.

```typescript
// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/utils/auth'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
const MAX_SIZE = { photo: 10 * 1024 * 1024, video: 50 * 1024 * 1024 }

export async function POST(req: NextRequest) {
  const user = await requireAuth()
  const formData = await req.formData()
  const file = formData.get('file') as File
  const context = formData.get('context') as string
  const parentListingId = formData.get('parentListingId') as string | null
  const evidenceRequestId = formData.get('evidenceRequestId') as string | null

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })
  }

  const isVideo = file.type.startsWith('video')
  const limit = isVideo ? MAX_SIZE.video : MAX_SIZE.photo
  if (file.size > limit) {
    return NextResponse.json({ error: 'File too large' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const path = `${user.id}/${Date.now()}-${file.name}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error } = await supabase.storage
    .from('proof-assets')
    .upload(path, buffer, { contentType: file.type })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage
    .from('proof-assets')
    .getPublicUrl(path)

  const asset = await prisma.proofAsset.create({
    data: {
      uploaderUserId:   user.id,
      assetType:        isVideo ? 'video' : 'photo',
      fileUrl:          publicUrl,
      context:          context as any,
      parentListingId:  parentListingId ?? undefined,
      evidenceRequestId: evidenceRequestId ?? undefined,
      qualityScore:     90, // MVP: static placeholder; replace with real check
    }
  })

  return NextResponse.json(asset, { status: 201 })
}
```

### Supabase Storage Bucket Policy

The `proof-assets` bucket uses the following row-level policy:
- **Read:** Public (any authenticated user can view proof assets).
- **Write:** Authenticated user can upload only to their own `user_id/` path prefix.
- **Delete:** Uploader or admin only.

---

## 9. Real-time Conversation Updates

Supabase Realtime subscribes to Postgres changes on the `messages` and `evidence_requests` tables. This eliminates the need for a WebSocket server in MVP.

```typescript
// hooks/useConversation.ts
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
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at')
      .then(({ data }) => setMessages(data ?? []))

    // Subscribe to new messages
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, payload => {
        setMessages(prev => [...prev, payload.new])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId])

  return messages
}
```

---

## 10. Notification System

Notifications are written to the `notifications` table (triggers in-app bell) AND dispatched via Resend email. A shared `notify()` function handles both.

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

interface NotifyParams {
  userId:        string
  userEmail:     string
  type:          NotificationType
  referenceType: string
  referenceId:   string
  body:          string
  emailSubject:  string
  emailTemplate: React.ReactElement
}

export async function notify(params: NotifyParams) {
  // 1. Write in-app notification
  await prisma.notification.create({
    data: {
      userId:        params.userId,
      type:          params.type,
      referenceType: params.referenceType,
      referenceId:   params.referenceId,
      body:          params.body,
    }
  })

  // 2. Send email
  await resend.emails.send({
    from:    'marketplace@youruniversity.edu',
    to:      params.userEmail,
    subject: params.emailSubject,
    react:   params.emailTemplate,
  })
}
```

### Notification Trigger Points

| Event | Recipients | Template |
|-------|-----------|---------|
| Match created (high confidence) | Buyer + Seller | `MatchFound.tsx` |
| Match created (medium confidence) | Buyer + Seller | `MatchFound.tsx` |
| EvidenceRequest created | Seller | `EvidenceRequested.tsx` |
| EvidenceRequest fulfilled | Buyer | `EvidenceFulfilled.tsx` |
| Offer received | Other party | `OfferReceived.tsx` |
| Offer accepted | Creator | `OfferAccepted.tsx` |
| Order created | Both | `OrderCreated.tsx` |
| Meetup time passed | Both | `CompletionPrompt.tsx` |
| Conversation closing in 2 days | Both | `InactivityWarning.tsx` |

---

## 11. Background Jobs (Supabase Edge Functions)

Four scheduled functions handle time-based state transitions. Each runs on a cron schedule via Supabase.

### expire-demands

Runs every hour. Finds DemandRequests where `expires_at < now()` and status is not terminal. Updates status to `expired`.

```typescript
// supabase/functions/expire-demands/index.ts
import { createClient } from '@supabase/supabase-js'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { error } = await supabase
    .from('demand_requests')
    .update({ status: 'expired' })
    .lt('expires_at', new Date().toISOString())
    .not('status', 'in', '("expired","cancelled","fulfilled")')

  return new Response(JSON.stringify({ error }), { status: error ? 500 : 200 })
})
```

Apply the same pattern for:
- `expire-listings` — targets `product_listings`
- `expire-offers` — targets `offers` where status = `pending`
- `close-inactive-conversations` — targets `conversations` where `auto_close_at < now()` and status = `active`; sets `status = closed`, `close_reason = expired`; also fires inactivity warning email at `auto_close_at - 2 days`

### Cron Schedule (set in Supabase Dashboard)

| Function | Schedule |
|----------|---------|
| expire-demands | `0 * * * *` (every hour) |
| expire-listings | `0 * * * *` |
| expire-offers | `*/15 * * * *` (every 15 minutes) |
| close-inactive-conversations | `0 */6 * * *` (every 6 hours) |

---

## 12. UI Component Architecture

### Key Pages and Their Components

**Conversation Page (`/conversations/[id]`):**

```
ConversationPage
├── StageIndicator           — shows current stage (verification / clarification / negotiation)
├── MatchSummaryBanner       — shows the matched demand and listing side by side
├── ProofAssetGallery        — seller's uploaded proof assets (lightbox)
├── EvidenceRequestList      — list of EvidenceRequest cards with status
│   └── EvidenceRequestCard  — shows request, status, fulfillment, or rejection
├── MessageThread            — real-time message list (useConversationMessages hook)
│   └── MessageBubble        — text message or system message
├── MessageInput             — text input (disabled in verification stage)
├── StageActions
│   ├── [verification] MarkProofSatisfactoryButton + RequestEvidenceButton
│   ├── [clarification] MoveToNegotiationButton
│   └── [negotiation] CreateOfferButton
└── ActiveOfferCard          — shows pending offer with Accept/Reject/Counter actions
```

**Listing Form (`/listings/new`):**

```
ListingForm
├── CategorySelector         — hierarchical category picker
├── ConditionSelector        — radio group with condition descriptions
├── ProofAssetUploader       — multi-file upload with quality feedback
│   ├── DropZone
│   ├── UploadedAssetPreview — thumbnail + quality score indicator
│   └── MinimumProofWarning  — shows if < 2 photos uploaded
├── PriceInput               — number input + price_flexible toggle
└── PublishButton            — disabled until proof requirements met
```

---

## 13. Environment Variables

```bash
# .env.local

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Database (Supabase Postgres connection string)
DATABASE_URL=
DIRECT_URL=        # for Prisma migrations (non-pooled)

# Email
RESEND_API_KEY=

# App config
ALLOWED_EMAIL_DOMAINS=university.edu,partner-university.edu
NEXT_PUBLIC_APP_URL=https://yourmarketplace.com

# Storage
SUPABASE_STORAGE_BUCKET=proof-assets
```

---

## 14. Deployment

### Stack Topology

```
Browser
  └── Vercel (Next.js app, API routes, Edge middleware)
        ├── Supabase Auth       — identity
        ├── Supabase Database   — Postgres (via Prisma connection pool)
        ├── Supabase Storage    — proof asset files
        ├── Supabase Realtime   — conversation live updates
        └── Supabase Functions  — background cron jobs
```

### Deployment Steps

1. Push code to GitHub.
2. Connect repo to Vercel. Set all environment variables in Vercel dashboard.
3. Connect Supabase project. Run `prisma migrate deploy` against the production database from CI.
4. Configure Supabase Auth: set allowed email domains in Auth > Settings > Restrict sign-ups.
5. Create `proof-assets` storage bucket in Supabase; apply bucket policies.
6. Deploy Edge Functions via Supabase CLI: `supabase functions deploy expire-demands`.
7. Set cron schedules in Supabase Dashboard > Edge Functions > Schedules.

### CI/CD (GitHub Actions, minimal)

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          DIRECT_URL:   ${{ secrets.DIRECT_URL }}
  # Vercel deploys automatically via its GitHub integration
```

---

## 15. Development Workflow

### Local Setup

```bash
# 1. Clone and install
git clone <repo>
cd student-marketplace
npm install

# 2. Copy env
cp .env.example .env.local
# Fill in Supabase local or cloud credentials

# 3. Run migrations
npx prisma migrate dev

# 4. Seed categories
npx prisma db seed

# 5. Start dev server
npm run dev
```

### Prisma Workflow

```bash
# After changing schema.prisma
npx prisma migrate dev --name <describe_change>

# Generate updated client
npx prisma generate

# Explore data locally
npx prisma studio
```

### Recommended Development Order

| Sprint | Focus |
|--------|-------|
| 1 | Auth + email verification + StudentProfile creation |
| 2 | Category taxonomy + ProductListing creation + ProofAsset upload |
| 3 | DemandRequest creation + Matching engine v1 + Match record creation |
| 4 | Match notification + Conversation creation + Verification stage |
| 5 | EvidenceRequest flow + Clarification stage |
| 6 | Offer creation + counter-offer + acceptance + Order creation |
| 7 | Order completion confirmation + RatingReview |
| 8 | Dispute filing + Admin dashboard |
| 9 | Background jobs (expiry, inactivity close) |
| 10 | Polish: rate limiting, notification emails, edge case handling |

---

## 16. Phase 2 Upgrade Paths

| Concern | MVP Approach | Phase 2 Upgrade |
|---------|-------------|-----------------|
| Matching performance | Synchronous in API route | Move to a job queue (BullMQ + Redis) triggered on listing/demand creation |
| Matching quality | Rule-based scoring | ML ranking model trained on accepted/rejected matches |
| Proof quality scoring | Static placeholder score | Image analysis API (e.g., Google Vision) for blur, completeness detection |
| Notifications | Email only | Add push (Expo for mobile app, or web push) |
| Real-time | Supabase Realtime | Upgrade to dedicated WebSocket server if Supabase Realtime limits are hit |
| Payments | None | Stripe Connect for escrow; release on mutual confirmation |
| Multi-campus | Single campus | Add University model; scope all queries by university |
| Moderation | Admin manual queue | Fine-tuned content classifier; automated shadow-banning |
| Location | String zone label | GPS coordinates + PostGIS for distance-based matching |
| Mobile | Mobile-first web | React Native app using the same API layer |
