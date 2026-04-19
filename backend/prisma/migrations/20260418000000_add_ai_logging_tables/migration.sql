-- CreateTable: match_snapshots
CREATE TABLE "match_snapshots" (
    "id"                TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
    "match_id"          TEXT         NOT NULL,
    "model_version"     TEXT         NOT NULL DEFAULT 'v1',
    "rank_position"     INTEGER      NOT NULL,
    "candidate_set_size" INTEGER     NOT NULL,
    "text_score"        DOUBLE PRECISION NOT NULL,
    "visual_score"      DOUBLE PRECISION,
    "final_score"       DOUBLE PRECISION NOT NULL,
    "penalties_applied" JSONB        NOT NULL,
    "demand_snapshot"   JSONB        NOT NULL,
    "listing_snapshot"  JSONB        NOT NULL,
    "feature_vector"    JSONB        NOT NULL,
    "created_at"        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT "match_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable: match_interactions
CREATE TABLE "match_interactions" (
    "id"          TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
    "match_id"    TEXT        NOT NULL,
    "snapshot_id" TEXT,
    "user_id"     TEXT        NOT NULL,
    "action"      TEXT        NOT NULL,
    "surface"     TEXT,
    "session_id"  TEXT,
    "metadata"    JSONB,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "match_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ai_match_logs
CREATE TABLE "ai_match_logs" (
    "id"               TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
    "triggered_by"     TEXT        NOT NULL,
    "source_id"        TEXT        NOT NULL,
    "source_text"      TEXT        NOT NULL,
    "candidate_count"  INTEGER     NOT NULL,
    "results"          JSONB       NOT NULL,
    "matches_created"  INTEGER     NOT NULL,
    "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "ai_match_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ai_call_logs
CREATE TABLE "ai_call_logs" (
    "id"          TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
    "endpoint"    TEXT        NOT NULL,
    "input_data"  JSONB       NOT NULL,
    "output_data" JSONB,
    "latency_ms"  DOUBLE PRECISION,
    "error"       TEXT,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "ai_call_logs_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one snapshot per match
ALTER TABLE "match_snapshots" ADD CONSTRAINT "match_snapshots_match_id_key" UNIQUE ("match_id");

-- Foreign keys: match_snapshots
ALTER TABLE "match_snapshots"
    ADD CONSTRAINT "match_snapshots_match_id_fkey"
    FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign keys: match_interactions
ALTER TABLE "match_interactions"
    ADD CONSTRAINT "match_interactions_match_id_fkey"
    FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "match_interactions"
    ADD CONSTRAINT "match_interactions_snapshot_id_fkey"
    FOREIGN KEY ("snapshot_id") REFERENCES "match_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "match_interactions"
    ADD CONSTRAINT "match_interactions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Indexes: match_interactions
CREATE INDEX "match_interactions_match_id_idx"  ON "match_interactions"("match_id");
CREATE INDEX "match_interactions_user_id_idx"   ON "match_interactions"("user_id");
CREATE INDEX "match_interactions_action_idx"    ON "match_interactions"("action");
CREATE INDEX "match_interactions_created_at_idx" ON "match_interactions"("created_at");

-- Indexes: ai_call_logs
CREATE INDEX "ai_call_logs_endpoint_idx"   ON "ai_call_logs"("endpoint");
CREATE INDEX "ai_call_logs_created_at_idx" ON "ai_call_logs"("created_at");
