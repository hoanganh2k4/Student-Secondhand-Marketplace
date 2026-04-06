# Database Schema (Prisma)

> File path in repo: `prisma/schema.prisma`
> Database: PostgreSQL via Supabase
> ORM: Prisma

---

## Setup

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

---

## Enums

```prisma
// ─── IDENTITY ─────────────────────────────────────────────────────────────

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

// ─── ITEM ─────────────────────────────────────────────────────────────────

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

// ─── DEMAND / LISTING STATUS ──────────────────────────────────────────────

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

// ─── MATCH ────────────────────────────────────────────────────────────────

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

// ─── CONVERSATION ─────────────────────────────────────────────────────────

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

// ─── EVIDENCE ─────────────────────────────────────────────────────────────

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

// ─── TRANSACTION ──────────────────────────────────────────────────────────

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

// ─── DISPUTE ──────────────────────────────────────────────────────────────

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

// ─── MESSAGING / ASSETS ───────────────────────────────────────────────────

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
```

---

## Models

### Identity

```prisma
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
```

### Taxonomy

```prisma
model Category {
  id                 String     @id @default(uuid())
  name               String
  parentId           String?    @map("parent_id")
  proofRequirements  Json?      @map("proof_requirements")
  matchingAttributes Json?      @map("matching_attributes")
  isActive           Boolean    @default(true) @map("is_active")

  parent   Category?  @relation("CategoryHierarchy", fields: [parentId], references: [id])
  children Category[] @relation("CategoryHierarchy")

  demandRequests       DemandRequest[]  @relation("DemandCategory")
  demandSubs           DemandRequest[]  @relation("DemandSubcategory")
  listingCategories    ProductListing[] @relation("ListingCategory")
  listingSubcategories ProductListing[] @relation("ListingSubcategory")

  @@map("categories")
}
```

### Supply and Demand

```prisma
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
  id                     String        @id @default(uuid())
  sellerProfileId        String        @map("seller_profile_id")
  title                  String
  categoryId             String        @map("category_id")
  subcategoryId          String?       @map("subcategory_id")
  description            String?
  condition              ItemCondition
  conditionNotes         String?       @map("condition_notes")
  quantityAvailable      Int           @map("quantity_available")
  quantityRemaining      Int           @map("quantity_remaining")
  priceExpectation       Decimal       @map("price_expectation") @db.Decimal(10, 2)
  priceFlexible          Boolean       @default(false) @map("price_flexible")
  location               String?
  availabilityWindow     String?       @map("availability_window")
  status                 ListingStatus @default(draft)
  proofCompletenessScore Int           @default(0) @map("proof_completeness_score")
  expiresAt              DateTime      @map("expires_at")
  createdAt              DateTime      @default(now()) @map("created_at")

  sellerProfile SellerProfile @relation(fields: [sellerProfileId], references: [id])
  category      Category      @relation("ListingCategory", fields: [categoryId], references: [id])
  subcategory   Category?     @relation("ListingSubcategory", fields: [subcategoryId], references: [id])
  proofAssets   ProofAsset[]
  matches       Match[]

  @@map("product_listings")
}
```

### Proof

```prisma
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
```

### Matching

```prisma
model Match {
  id                String          @id @default(uuid())
  demandRequestId   String          @map("demand_request_id")
  productListingId  String          @map("product_listing_id")
  matchScore        Int             @map("match_score")
  matchConfidence   MatchConfidence @map("match_confidence")
  scoreBreakdown    Json            @map("score_breakdown")
  missingInfoFlags  String[]        @map("missing_info_flags")
  status            MatchStatus     @default(proposed)
  buyerAcknowledged  Boolean        @default(false) @map("buyer_acknowledged")
  sellerAcknowledged Boolean        @default(false) @map("seller_acknowledged")
  createdAt         DateTime        @default(now()) @map("created_at")

  demandRequest  DemandRequest  @relation(fields: [demandRequestId], references: [id])
  productListing ProductListing @relation(fields: [productListingId], references: [id])
  conversation   Conversation?
  offers         Offer[]
  orders         Order[]

  @@unique([demandRequestId, productListingId])
  @@map("matches")
}
```

### Conversation

```prisma
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
  id                String      @id @default(uuid())
  conversationId    String      @map("conversation_id")
  senderUserId      String      @map("sender_user_id")
  messageType       MessageType @map("message_type")
  body              String
  isSystemGenerated Boolean     @default(false) @map("is_system_generated")
  createdAt         DateTime    @default(now()) @map("created_at")

  conversation Conversation @relation(fields: [conversationId], references: [id])
  sender       User         @relation(fields: [senderUserId], references: [id])

  @@map("messages")
}

model EvidenceRequest {
  id              String                @id @default(uuid())
  conversationId  String                @map("conversation_id")
  requesterUserId String                @map("requester_user_id")
  requestType     EvidenceRequestType   @map("request_type")
  description     String
  status          EvidenceRequestStatus @default(pending)
  dueAt           DateTime              @map("due_at")
  fulfilledAt     DateTime?             @map("fulfilled_at")
  rejectionReason String?               @map("rejection_reason")

  conversation Conversation @relation(fields: [conversationId], references: [id])
  requester    User         @relation(fields: [requesterUserId], references: [id])
  proofAssets  ProofAsset[]

  @@map("evidence_requests")
}
```

### Transaction

```prisma
model Offer {
  id                String            @id @default(uuid())
  conversationId    String            @map("conversation_id")
  createdByUserId   String            @map("created_by_user_id")
  matchId           String            @map("match_id")
  quantity          Int
  proposedPrice     Decimal           @map("proposed_price") @db.Decimal(10, 2)
  totalPrice        Decimal           @map("total_price") @db.Decimal(10, 2)
  fulfillmentMethod FulfillmentMethod @map("fulfillment_method")
  meetupLocation    String?           @map("meetup_location")
  meetupTime        DateTime?         @map("meetup_time")
  termsNotes        String?           @map("terms_notes")
  proofSnapshot     Json?             @map("proof_snapshot")
  parentOfferId     String?           @map("parent_offer_id")
  counterOfferId    String?           @map("counter_offer_id")
  status            OfferStatus       @default(draft)
  expiresAt         DateTime          @map("expires_at")
  createdAt         DateTime          @default(now()) @map("created_at")

  conversation Conversation @relation(fields: [conversationId], references: [id])
  createdBy    User         @relation(fields: [createdByUserId], references: [id])
  match        Match        @relation(fields: [matchId], references: [id])
  parentOffer  Offer?       @relation("OfferChain", fields: [parentOfferId], references: [id])
  childOffers  Offer[]      @relation("OfferChain")
  order        Order?

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
```

### Post-Transaction

```prisma
model RatingReview {
  id             String     @id @default(uuid())
  orderId        String     @map("order_id")
  reviewerUserId String     @map("reviewer_user_id")
  reviewedUserId String     @map("reviewed_user_id")
  roleOfReviewer ReviewRole @map("role_of_reviewer")
  rating         Int
  comment        String?
  createdAt      DateTime   @default(now()) @map("created_at")

  order    Order @relation(fields: [orderId], references: [id])
  reviewer User  @relation("Reviewer", fields: [reviewerUserId], references: [id])
  reviewed User  @relation("Reviewed", fields: [reviewedUserId], references: [id])

  @@unique([orderId, roleOfReviewer])
  @@map("rating_reviews")
}

model Dispute {
  id              String             @id @default(uuid())
  orderId         String             @unique @map("order_id")
  filedByUserId   String             @map("filed_by_user_id")
  disputeType     DisputeType        @map("dispute_type")
  description     String
  evidenceAssets  String[]           @map("evidence_assets")
  status          DisputeStatus      @default(opened)
  assignedAdminId String?            @map("assigned_admin_id")
  resolution      DisputeResolution?
  resolutionNotes String?            @map("resolution_notes")
  openedAt        DateTime           @default(now()) @map("opened_at")
  resolvedAt      DateTime?          @map("resolved_at")

  order         Order @relation(fields: [orderId], references: [id])
  filedBy       User  @relation("DisputeFiler", fields: [filedByUserId], references: [id])
  assignedAdmin User? @relation("DisputeAdmin", fields: [assignedAdminId], references: [id])

  @@map("disputes")
}
```

### System

```prisma
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

## Prisma CLI Cheatsheet

```bash
# Create a new migration after schema changes
npx prisma migrate dev --name <describe_change>

# Apply migrations in production (CI)
npx prisma migrate deploy

# Regenerate Prisma client after schema changes
npx prisma generate

# Open data browser locally
npx prisma studio
```
