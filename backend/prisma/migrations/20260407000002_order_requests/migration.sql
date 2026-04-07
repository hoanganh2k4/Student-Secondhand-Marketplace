-- Create OrderRequestStatus enum
CREATE TYPE "OrderRequestStatus" AS ENUM ('pending', 'accepted', 'rejected', 'seller_filled', 'buyer_filled', 'completed');

-- Create order_requests table
CREATE TABLE "order_requests" (
  "id"                   TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "conversation_id"      TEXT         NOT NULL,
  "initiated_by_user_id" TEXT         NOT NULL,
  "status"               "OrderRequestStatus" NOT NULL DEFAULT 'pending',
  "price"                DECIMAL(10,2),
  "quantity"             INT          NOT NULL DEFAULT 1,
  "fulfillment_method"   TEXT,
  "buyer_phone"          TEXT,
  "buyer_email"          TEXT,
  "delivery_address"     TEXT,
  "order_id"             TEXT         UNIQUE,
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "order_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_requests_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "order_requests_initiated_by_user_id_fkey"
    FOREIGN KEY ("initiated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
