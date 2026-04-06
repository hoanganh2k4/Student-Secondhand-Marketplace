-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended', 'banned');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('unverified', 'email_verified', 'id_verified');

-- CreateEnum
CREATE TYPE "TrustTier" AS ENUM ('new', 'established', 'trusted');

-- CreateEnum
CREATE TYPE "ItemCondition" AS ENUM ('poor', 'fair', 'good', 'very_good', 'like_new');

-- CreateEnum
CREATE TYPE "Urgency" AS ENUM ('flexible', 'within_week', 'within_month');

-- CreateEnum
CREATE TYPE "DemandStatus" AS ENUM ('draft', 'active', 'waiting', 'matched', 'in_conversation', 'in_negotiation', 'fulfilled', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('draft', 'active', 'matched', 'in_conversation', 'partially_sold', 'sold', 'expired', 'removed');

-- CreateEnum
CREATE TYPE "MatchConfidence" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('proposed', 'buyer_confirmed', 'seller_confirmed', 'active', 'closed_success', 'closed_failed', 'expired');

-- CreateEnum
CREATE TYPE "ConversationStage" AS ENUM ('verification', 'clarification', 'negotiation', 'closed');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('active', 'closed');

-- CreateEnum
CREATE TYPE "CloseReason" AS ENUM ('completed', 'abandoned', 'expired', 'admin_closed');

-- CreateEnum
CREATE TYPE "EvidenceRequestType" AS ENUM ('additional_photo', 'video', 'measurement', 'document', 'live_demo');

-- CreateEnum
CREATE TYPE "EvidenceRequestStatus" AS ENUM ('pending', 'fulfilled', 'rejected', 'expired');

-- CreateEnum
CREATE TYPE "FulfillmentMethod" AS ENUM ('pickup', 'delivery', 'flexible');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('draft', 'pending', 'countered', 'accepted', 'rejected', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('created', 'confirmed', 'in_progress', 'completed', 'cancelled', 'disputed');

-- CreateEnum
CREATE TYPE "DisputeType" AS ENUM ('item_not_as_described', 'no_show', 'fake_proof', 'other');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('opened', 'under_review', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "DisputeResolution" AS ENUM ('resolved_for_buyer', 'resolved_for_seller', 'mutual', 'dismissed');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('text', 'system', 'evidence_request', 'offer_notification');

-- CreateEnum
CREATE TYPE "AssetContext" AS ENUM ('initial_listing', 'evidence_response', 'demand_reference');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('photo', 'video', 'document');

-- CreateEnum
CREATE TYPE "ReviewRole" AS ENUM ('buyer', 'seller');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "university" TEXT NOT NULL,
    "student_id_number" TEXT,
    "student_id_asset_id" TEXT,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'unverified',
    "verified_at" TIMESTAMP(3),
    "graduation_year" INTEGER,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyer_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "preferred_categories" TEXT[],
    "default_location" TEXT,
    "buyer_rating" DECIMAL(3,2),
    "total_orders_completed" INTEGER NOT NULL DEFAULT 0,
    "trust_tier" "TrustTier" NOT NULL DEFAULT 'new',

    CONSTRAINT "buyer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "seller_rating" DECIMAL(3,2),
    "total_listings_created" INTEGER NOT NULL DEFAULT 0,
    "total_orders_completed" INTEGER NOT NULL DEFAULT 0,
    "trust_tier" "TrustTier" NOT NULL DEFAULT 'new',
    "preferred_meetup_zones" TEXT[],
    "availability_notes" TEXT,

    CONSTRAINT "seller_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,
    "proof_requirements" JSONB,
    "matching_attributes" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demand_requests" (
    "id" TEXT NOT NULL,
    "buyer_profile_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "subcategory_id" TEXT,
    "description" TEXT,
    "budget_min" DECIMAL(10,2) NOT NULL,
    "budget_max" DECIMAL(10,2) NOT NULL,
    "preferred_condition" "ItemCondition" NOT NULL DEFAULT 'good',
    "quantity_needed" INTEGER NOT NULL DEFAULT 1,
    "fulfilled_quantity" INTEGER NOT NULL DEFAULT 0,
    "location" TEXT,
    "urgency" "Urgency" NOT NULL DEFAULT 'flexible',
    "special_requirements" TEXT,
    "status" "DemandStatus" NOT NULL DEFAULT 'draft',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demand_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_listings" (
    "id" TEXT NOT NULL,
    "seller_profile_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "subcategory_id" TEXT,
    "description" TEXT,
    "condition" "ItemCondition" NOT NULL,
    "condition_notes" TEXT,
    "quantity_available" INTEGER NOT NULL,
    "quantity_remaining" INTEGER NOT NULL,
    "price_expectation" DECIMAL(10,2) NOT NULL,
    "price_flexible" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "availability_window" TEXT,
    "status" "ListingStatus" NOT NULL DEFAULT 'draft',
    "proof_completeness_score" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proof_assets" (
    "id" TEXT NOT NULL,
    "uploader_user_id" TEXT NOT NULL,
    "asset_type" "AssetType" NOT NULL,
    "file_url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "context" "AssetContext" NOT NULL,
    "parent_listing_id" TEXT,
    "parent_demand_id" TEXT,
    "evidence_request_id" TEXT,
    "quality_score" INTEGER,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proof_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "demand_request_id" TEXT NOT NULL,
    "product_listing_id" TEXT NOT NULL,
    "match_score" INTEGER NOT NULL,
    "match_confidence" "MatchConfidence" NOT NULL,
    "score_breakdown" JSONB NOT NULL,
    "missing_info_flags" TEXT[],
    "status" "MatchStatus" NOT NULL DEFAULT 'proposed',
    "buyer_acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "seller_acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "buyer_user_id" TEXT NOT NULL,
    "seller_user_id" TEXT NOT NULL,
    "stage" "ConversationStage" NOT NULL DEFAULT 'verification',
    "stage_entered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auto_close_at" TIMESTAMP(3) NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'active',
    "close_reason" "CloseReason",

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "sender_user_id" TEXT NOT NULL,
    "message_type" "MessageType" NOT NULL,
    "body" TEXT NOT NULL,
    "is_system_generated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_requests" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "requester_user_id" TEXT NOT NULL,
    "request_type" "EvidenceRequestType" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "EvidenceRequestStatus" NOT NULL DEFAULT 'pending',
    "due_at" TIMESTAMP(3) NOT NULL,
    "fulfilled_at" TIMESTAMP(3),
    "rejection_reason" TEXT,

    CONSTRAINT "evidence_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "proposed_price" DECIMAL(10,2) NOT NULL,
    "total_price" DECIMAL(10,2) NOT NULL,
    "fulfillment_method" "FulfillmentMethod" NOT NULL,
    "meetup_location" TEXT,
    "meetup_time" TIMESTAMP(3),
    "terms_notes" TEXT,
    "proof_snapshot" JSONB,
    "parent_offer_id" TEXT,
    "counter_offer_id" TEXT,
    "status" "OfferStatus" NOT NULL DEFAULT 'draft',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "offer_id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "buyer_user_id" TEXT NOT NULL,
    "seller_user_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "final_price" DECIMAL(10,2) NOT NULL,
    "fulfillment_method" TEXT NOT NULL,
    "meetup_details" TEXT,
    "proof_snapshot" JSONB,
    "status" "OrderStatus" NOT NULL DEFAULT 'created',
    "buyer_confirmed_complete" BOOLEAN NOT NULL DEFAULT false,
    "seller_confirmed_complete" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rating_reviews" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "reviewer_user_id" TEXT NOT NULL,
    "reviewed_user_id" TEXT NOT NULL,
    "role_of_reviewer" "ReviewRole" NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rating_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "filed_by_user_id" TEXT NOT NULL,
    "dispute_type" "DisputeType" NOT NULL,
    "description" TEXT NOT NULL,
    "evidence_assets" TEXT[],
    "status" "DisputeStatus" NOT NULL DEFAULT 'opened',
    "assigned_admin_id" TEXT,
    "resolution" "DisputeResolution",
    "resolution_notes" TEXT,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "body" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_user_id_key" ON "student_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "buyer_profiles_user_id_key" ON "buyer_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "seller_profiles_user_id_key" ON "seller_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "matches_demand_request_id_product_listing_id_key" ON "matches"("demand_request_id", "product_listing_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_match_id_key" ON "conversations"("match_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_offer_id_key" ON "orders"("offer_id");

-- CreateIndex
CREATE UNIQUE INDEX "rating_reviews_order_id_role_of_reviewer_key" ON "rating_reviews"("order_id", "role_of_reviewer");

-- CreateIndex
CREATE UNIQUE INDEX "disputes_order_id_key" ON "disputes"("order_id");

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_profiles" ADD CONSTRAINT "buyer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_requests" ADD CONSTRAINT "demand_requests_buyer_profile_id_fkey" FOREIGN KEY ("buyer_profile_id") REFERENCES "buyer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_requests" ADD CONSTRAINT "demand_requests_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_requests" ADD CONSTRAINT "demand_requests_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_listings" ADD CONSTRAINT "product_listings_seller_profile_id_fkey" FOREIGN KEY ("seller_profile_id") REFERENCES "seller_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_listings" ADD CONSTRAINT "product_listings_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_listings" ADD CONSTRAINT "product_listings_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_assets" ADD CONSTRAINT "proof_assets_uploader_user_id_fkey" FOREIGN KEY ("uploader_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_assets" ADD CONSTRAINT "proof_assets_parent_listing_id_fkey" FOREIGN KEY ("parent_listing_id") REFERENCES "product_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_assets" ADD CONSTRAINT "proof_assets_evidence_request_id_fkey" FOREIGN KEY ("evidence_request_id") REFERENCES "evidence_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_demand_request_id_fkey" FOREIGN KEY ("demand_request_id") REFERENCES "demand_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_product_listing_id_fkey" FOREIGN KEY ("product_listing_id") REFERENCES "product_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_buyer_user_id_fkey" FOREIGN KEY ("buyer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_seller_user_id_fkey" FOREIGN KEY ("seller_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_requests" ADD CONSTRAINT "evidence_requests_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_requests" ADD CONSTRAINT "evidence_requests_requester_user_id_fkey" FOREIGN KEY ("requester_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_parent_offer_id_fkey" FOREIGN KEY ("parent_offer_id") REFERENCES "offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_user_id_fkey" FOREIGN KEY ("buyer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_seller_user_id_fkey" FOREIGN KEY ("seller_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating_reviews" ADD CONSTRAINT "rating_reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating_reviews" ADD CONSTRAINT "rating_reviews_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating_reviews" ADD CONSTRAINT "rating_reviews_reviewed_user_id_fkey" FOREIGN KEY ("reviewed_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_filed_by_user_id_fkey" FOREIGN KEY ("filed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_assigned_admin_id_fkey" FOREIGN KEY ("assigned_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
