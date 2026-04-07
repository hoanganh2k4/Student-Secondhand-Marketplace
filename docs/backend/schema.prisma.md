# Prisma Schema

> File: `backend/prisma/schema.prisma`
> Database: PostgreSQL
> All IDs: `String @id @default(uuid())` — stored as TEXT in Postgres (not native UUID type)

---

## Enums

| Enum | Values |
|------|--------|
| `UserStatus` | `active`, `suspended`, `banned` |
| `VerificationStatus` | `unverified`, `email_verified`, `id_verified` |
| `TrustTier` | `new`, `established`, `trusted` |
| `ItemCondition` | `poor`, `fair`, `good`, `very_good`, `like_new` |
| `Urgency` | `flexible`, `within_week`, `within_month` |
| `DemandStatus` | `draft`, `active`, `waiting`, `matched`, `in_conversation`, `in_negotiation`, `fulfilled`, `expired`, `cancelled` |
| `ListingStatus` | `draft`, `active`, `matched`, `in_conversation`, `partially_sold`, `sold`, `expired`, `removed` |
| `MatchConfidence` | `high`, `medium`, `low` |
| `MatchStatus` | `proposed`, `buyer_confirmed`, `seller_confirmed`, `active`, `closed_success`, `closed_failed`, `expired` |
| `ConversationStage` | `verification`, `clarification`, `negotiation`, `closed` |
| `ConversationStatus` | `active`, `closed` |
| `CloseReason` | `completed`, `abandoned`, `expired`, `admin_closed` |
| `EvidenceRequestType` | `additional_photo`, `video`, `measurement`, `document`, `live_demo` |
| `EvidenceRequestStatus` | `pending`, `fulfilled`, `rejected`, `expired` |
| `FulfillmentMethod` | `pickup`, `delivery`, `flexible` |
| `OfferStatus` | `draft`, `pending`, `countered`, `accepted`, `rejected`, `expired`, `cancelled` |
| `OrderStatus` | `created`, `confirmed`, `in_progress`, `completed`, `cancelled`, `disputed` |
| `OrderRequestStatus` | `pending`, `accepted`, `rejected`, `seller_filled`, `buyer_filled`, `completed` |
| `DisputeType` | `item_not_as_described`, `no_show`, `fake_proof`, `other` |
| `DisputeStatus` | `opened`, `under_review`, `resolved`, `closed` |
| `DisputeResolution` | `resolved_for_buyer`, `resolved_for_seller`, `mutual`, `dismissed` |
| `MessageType` | `text`, `image`, `video`, `system`, `evidence_request`, `offer_notification` |
| `AssetContext` | `initial_listing`, `evidence_response`, `demand_reference` |
| `AssetType` | `photo`, `video`, `document` |
| `ReviewRole` | `buyer`, `seller` |

---

## Models

### User

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK, uuid |
| email | String | unique |
| emailVerified | Boolean | default false |
| name | String | |
| phone | String? | |
| passwordHash | String? | bcrypt |
| status | UserStatus | default `active` |
| isAdmin | Boolean | default false — admin dashboard access |
| createdAt | DateTime | |
| lastActiveAt | DateTime? | |

Relations: `studentProfile`, `buyerProfile`, `sellerProfile`, `notifications`, `uploadedAssets`, `sentMessages`, `filedDisputes`, `assignedDisputes`, `buyerConversations`, `sellerConversations`, `buyerOrders`, `sellerOrders`, `reviewsGiven`, `reviewsReceived`, `evidenceRequests`, `offersCreated`, `orderRequestsInitiated`

---

### StudentProfile

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| userId | String | unique FK → User |
| university | String | |
| studentIdNumber | String? | |
| studentIdAssetId | String? | FK to asset (raw, no Prisma relation) |
| verificationStatus | VerificationStatus | default `unverified` |
| verifiedAt | DateTime? | |
| graduationYear | Int? | |

---

### BuyerProfile

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| userId | String | unique FK → User |
| preferredCategories | String[] | |
| defaultLocation | String? | |
| buyerRating | Decimal? | 3,2 precision — updated after each review |
| totalOrdersCompleted | Int | default 0 |
| trustTier | TrustTier | default `new` |

---

### SellerProfile

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| userId | String | unique FK → User |
| sellerRating | Decimal? | 3,2 precision — updated after each review |
| totalListingsCreated | Int | default 0 |
| totalOrdersCompleted | Int | default 0 |
| trustTier | TrustTier | default `new` |
| preferredMeetupZones | String[] | |
| availabilityNotes | String? | |

---

### Category

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| name | String | |
| parentId | String? | self-relation (hierarchy) |
| proofRequirements | Json? | |
| matchingAttributes | Json? | |
| isActive | Boolean | default true |

---

### DemandRequest

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| buyerProfileId | String | FK → BuyerProfile |
| title | String | |
| categoryId | String | FK → Category |
| subcategoryId | String? | FK → Category |
| description | String? | |
| budgetMin | Decimal | 10,2 |
| budgetMax | Decimal | 10,2 |
| preferredCondition | ItemCondition | default `good` |
| quantityNeeded | Int | default 1 |
| fulfilledQuantity | Int | default 0 |
| location | String? | |
| urgency | Urgency | default `flexible` |
| specialRequirements | String? | |
| status | DemandStatus | default `draft` |
| expiresAt | DateTime | |
| createdAt | DateTime | |

---

### ProductListing

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| sellerProfileId | String | FK → SellerProfile |
| title | String | |
| categoryId | String | FK → Category |
| subcategoryId | String? | FK → Category |
| description | String? | |
| condition | ItemCondition | |
| conditionNotes | String? | |
| quantityAvailable | Int | |
| quantityRemaining | Int | |
| priceExpectation | Decimal | 10,2 |
| priceFlexible | Boolean | default false |
| location | String? | |
| availabilityWindow | String? | |
| status | ListingStatus | default `draft` |
| proofCompletenessScore | Int | default 0 |
| expiresAt | DateTime | |
| createdAt | DateTime | |

---

### ProofAsset

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| uploaderUserId | String | FK → User |
| assetType | AssetType | |
| fileUrl | String | MinIO public URL |
| thumbnailUrl | String? | |
| context | AssetContext | |
| parentListingId | String? | FK → ProductListing |
| parentDemandId | String? | raw FK (no Prisma relation) |
| evidenceRequestId | String? | FK → EvidenceRequest |
| qualityScore | Int? | 0–100 from AI analysis |
| aiAttributes | Json? | Florence-2 output: colors, brand, condition tags, etc. |
| flagged | Boolean | default false |
| createdAt | DateTime | |

---

### Match

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| demandRequestId | String | FK → DemandRequest |
| productListingId | String | FK → ProductListing |
| matchScore | Int | 0–100 |
| matchConfidence | MatchConfidence | |
| scoreBreakdown | Json | per-dimension scores |
| missingInfoFlags | String[] | |
| status | MatchStatus | default `proposed` |
| buyerAcknowledged | Boolean | default false |
| sellerAcknowledged | Boolean | default false |
| createdAt | DateTime | |

Unique: `(demandRequestId, productListingId)`

---

### Conversation

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| matchId | String | unique FK → Match |
| buyerUserId | String | FK → User |
| sellerUserId | String | FK → User |
| stage | ConversationStage | default `verification` |
| stageEnteredAt | DateTime | |
| lastActivityAt | DateTime | |
| autoCloseAt | DateTime | |
| status | ConversationStatus | default `active` |
| closeReason | CloseReason? | |

Relations: `messages`, `evidenceRequests`, `offers`, `orderRequests`

---

### OrderRequest

> Created in-chat when one party clicks "Order". Drives the two-step info-collection flow before an Order is created.

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| conversationId | String | FK → Conversation (TEXT, not UUID) |
| initiatedByUserId | String | FK → User |
| status | OrderRequestStatus | default `pending` |
| price | Decimal? | 10,2 — filled by seller |
| quantity | Int | default 1 — filled by seller |
| fulfillmentMethod | String? | filled by buyer |
| buyerPhone | String? | filled by buyer |
| buyerEmail | String? | filled by buyer |
| deliveryAddress | String? | filled by buyer |
| orderId | String? | unique — set when Order is auto-created |
| createdAt | DateTime | |
| updatedAt | DateTime | auto-updated |

**Status flow:** `pending → accepted → seller_filled / buyer_filled → completed`

---

### Message

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| conversationId | String | FK → Conversation |
| senderUserId | String | FK → User |
| messageType | MessageType | |
| body | String | System order messages use `__order_request:<id>__` placeholder |
| mediaUrl | String? | MinIO URL for image/video messages |
| mediaKey | String? | MinIO object key (used for deletion) |
| isSystemGenerated | Boolean | default false |
| createdAt | DateTime | |

---

### EvidenceRequest

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| conversationId | String | FK → Conversation |
| requesterUserId | String | FK → User |
| requestType | EvidenceRequestType | |
| description | String | |
| status | EvidenceRequestStatus | default `pending` |
| dueAt | DateTime | |
| fulfilledAt | DateTime? | |
| rejectionReason | String? | |

---

### Offer

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| conversationId | String | FK → Conversation |
| createdByUserId | String | FK → User |
| matchId | String | FK → Match |
| quantity | Int | |
| proposedPrice | Decimal | 10,2 |
| totalPrice | Decimal | 10,2 |
| fulfillmentMethod | FulfillmentMethod | |
| meetupLocation | String? | |
| meetupTime | DateTime? | |
| termsNotes | String? | |
| proofSnapshot | Json? | |
| parentOfferId | String? | counter-offer chain |
| counterOfferId | String? | |
| status | OfferStatus | default `draft` |
| expiresAt | DateTime | |
| createdAt | DateTime | |

> In the OrderRequest flow, an Offer is auto-created internally by `finalizeOrder()` — users do not create Offers directly.

---

### Order

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| offerId | String | unique FK → Offer |
| matchId | String | FK → Match |
| buyerUserId | String | FK → User |
| sellerUserId | String | FK → User |
| quantity | Int | |
| finalPrice | Decimal | 10,2 |
| fulfillmentMethod | String | |
| meetupDetails | String? | |
| proofSnapshot | Json? | |
| status | OrderStatus | default `created` |
| buyerConfirmedComplete | Boolean | default false |
| sellerConfirmedComplete | Boolean | default false |
| completedAt | DateTime? | set when both confirm |
| createdAt | DateTime | |
| cancelledAt | DateTime? | |
| cancellationReason | String? | |

---

### RatingReview

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| orderId | String | FK → Order |
| reviewerUserId | String | FK → User |
| reviewedUserId | String | FK → User |
| roleOfReviewer | ReviewRole | |
| rating | Int | 1–5 |
| comment | String? | |
| createdAt | DateTime | |

Unique: `(orderId, roleOfReviewer)` — one review per role per order

---

### Dispute

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| orderId | String | unique FK → Order |
| filedByUserId | String | FK → User |
| disputeType | DisputeType | |
| description | String | |
| evidenceAssets | String[] | asset URLs |
| status | DisputeStatus | default `opened` |
| assignedAdminId | String? | FK → User (must be admin) |
| resolution | DisputeResolution? | |
| resolutionNotes | String? | |
| openedAt | DateTime | |
| resolvedAt | DateTime? | |

---

### Notification

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| userId | String | FK → User |
| type | String | e.g. `new_match`, `order_completed`, `review_received` |
| referenceType | String? | e.g. `order`, `match`, `conversation` |
| referenceId | String? | ID of the referenced entity |
| body | String | display text |
| read | Boolean | default false |
| createdAt | DateTime | |
