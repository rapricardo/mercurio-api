-- CreateTable
CREATE TABLE "tenant" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_key" (
    "id" BIGSERIAL NOT NULL,
    "workspace_id" BIGINT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "key_hash" VARCHAR(255) NOT NULL,
    "scopes" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "api_key_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitor" (
    "anonymous_id" VARCHAR(50) NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "workspace_id" BIGINT NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "first_utm" JSONB,
    "last_utm" JSONB,
    "last_device" JSONB,
    "last_geo" JSONB,

    CONSTRAINT "visitor_pkey" PRIMARY KEY ("anonymous_id")
);

-- CreateTable
CREATE TABLE "lead" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "workspace_id" BIGINT NOT NULL,
    "email_enc" TEXT,
    "email_fingerprint" VARCHAR(64),
    "email_key_version" INTEGER DEFAULT 1,
    "phone_enc" TEXT,
    "phone_fingerprint" VARCHAR(64),
    "phone_key_version" INTEGER DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_link" (
    "tenant_id" BIGINT NOT NULL,
    "workspace_id" BIGINT NOT NULL,
    "anonymous_id" VARCHAR(50) NOT NULL,
    "lead_id" BIGINT NOT NULL,
    "first_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identity_link_pkey" PRIMARY KEY ("tenant_id","workspace_id","anonymous_id","lead_id")
);

-- CreateTable
CREATE TABLE "session" (
    "session_id" VARCHAR(50) NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "workspace_id" BIGINT NOT NULL,
    "anonymous_id" VARCHAR(50) NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "user_agent" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "event" (
    "id" BIGSERIAL NOT NULL,
    "event_id" VARCHAR(100),
    "schema_version" VARCHAR(10) NOT NULL,
    "event_name" VARCHAR(100) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "workspace_id" BIGINT NOT NULL,
    "anonymous_id" VARCHAR(50) NOT NULL,
    "lead_id" BIGINT,
    "session_id" VARCHAR(50),
    "page" JSONB,
    "utm" JSONB,
    "device" JSONB,
    "geo" JSONB,
    "props" JSONB,
    "ingested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_pkey" PRIMARY KEY ("id","tenant_id","timestamp")
);

-- CreateTable
CREATE TABLE "funnel" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "workspace_id" BIGINT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "created_by" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "funnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funnel_version" (
    "id" BIGSERIAL NOT NULL,
    "funnel_id" BIGINT NOT NULL,
    "version" INTEGER NOT NULL,
    "state" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "created_by" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "funnel_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funnel_publication" (
    "id" BIGSERIAL NOT NULL,
    "funnel_id" BIGINT NOT NULL,
    "version" INTEGER NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "window_days" INTEGER NOT NULL DEFAULT 7,
    "notes" TEXT,

    CONSTRAINT "funnel_publication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funnel_step" (
    "id" BIGSERIAL NOT NULL,
    "funnel_version_id" BIGINT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "funnel_step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funnel_step_match" (
    "id" BIGSERIAL NOT NULL,
    "funnel_step_id" BIGINT NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "rules" JSONB NOT NULL,

    CONSTRAINT "funnel_step_match_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workspace_tenant_id_idx" ON "workspace"("tenant_id");

-- CreateIndex
CREATE INDEX "api_key_workspace_id_idx" ON "api_key"("workspace_id");

-- CreateIndex
CREATE INDEX "visitor_tenant_id_workspace_id_idx" ON "visitor"("tenant_id", "workspace_id");

-- CreateIndex
CREATE INDEX "visitor_tenant_id_workspace_id_last_seen_at_idx" ON "visitor"("tenant_id", "workspace_id", "last_seen_at");

-- CreateIndex
CREATE INDEX "lead_tenant_id_workspace_id_idx" ON "lead"("tenant_id", "workspace_id");

-- CreateIndex
CREATE INDEX "lead_tenant_id_workspace_id_email_fingerprint_idx" ON "lead"("tenant_id", "workspace_id", "email_fingerprint");

-- CreateIndex
CREATE INDEX "lead_tenant_id_workspace_id_phone_fingerprint_idx" ON "lead"("tenant_id", "workspace_id", "phone_fingerprint");

-- CreateIndex
CREATE INDEX "identity_link_tenant_id_workspace_id_anonymous_id_idx" ON "identity_link"("tenant_id", "workspace_id", "anonymous_id");

-- CreateIndex
CREATE INDEX "identity_link_tenant_id_workspace_id_lead_id_idx" ON "identity_link"("tenant_id", "workspace_id", "lead_id");

-- CreateIndex
CREATE INDEX "session_tenant_id_workspace_id_idx" ON "session"("tenant_id", "workspace_id");

-- CreateIndex
CREATE INDEX "session_tenant_id_workspace_id_anonymous_id_idx" ON "session"("tenant_id", "workspace_id", "anonymous_id");

-- CreateIndex
CREATE INDEX "session_tenant_id_workspace_id_started_at_idx" ON "session"("tenant_id", "workspace_id", "started_at");

-- CreateIndex
CREATE INDEX "event_tenant_id_workspace_id_timestamp_idx" ON "event"("tenant_id", "workspace_id", "timestamp");

-- CreateIndex
CREATE INDEX "event_tenant_id_workspace_id_anonymous_id_timestamp_idx" ON "event"("tenant_id", "workspace_id", "anonymous_id", "timestamp");

-- CreateIndex
CREATE INDEX "event_tenant_id_workspace_id_event_name_timestamp_idx" ON "event"("tenant_id", "workspace_id", "event_name", "timestamp");

-- CreateIndex
CREATE INDEX "event_tenant_id_workspace_id_lead_id_timestamp_idx" ON "event"("tenant_id", "workspace_id", "lead_id", "timestamp");

-- CreateIndex
CREATE INDEX "event_tenant_id_workspace_id_session_id_timestamp_idx" ON "event"("tenant_id", "workspace_id", "session_id", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "event_tenant_id_event_id_key" ON "event"("tenant_id", "event_id");

-- CreateIndex
CREATE INDEX "funnel_tenant_id_workspace_id_idx" ON "funnel"("tenant_id", "workspace_id");

-- CreateIndex
CREATE INDEX "funnel_tenant_id_workspace_id_created_at_idx" ON "funnel"("tenant_id", "workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "funnel_version_funnel_id_state_idx" ON "funnel_version"("funnel_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "funnel_version_funnel_id_version_key" ON "funnel_version"("funnel_id", "version");

-- CreateIndex
CREATE INDEX "funnel_publication_funnel_id_published_at_idx" ON "funnel_publication"("funnel_id", "published_at");

-- CreateIndex
CREATE INDEX "funnel_step_funnel_version_id_order_index_idx" ON "funnel_step"("funnel_version_id", "order_index");

-- CreateIndex
CREATE UNIQUE INDEX "funnel_step_funnel_version_id_order_index_key" ON "funnel_step"("funnel_version_id", "order_index");

-- CreateIndex
CREATE INDEX "funnel_step_match_funnel_step_id_idx" ON "funnel_step_match"("funnel_step_id");

-- AddForeignKey
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor" ADD CONSTRAINT "visitor_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor" ADD CONSTRAINT "visitor_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_link" ADD CONSTRAINT "identity_link_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_link" ADD CONSTRAINT "identity_link_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_link" ADD CONSTRAINT "identity_link_anonymous_id_fkey" FOREIGN KEY ("anonymous_id") REFERENCES "visitor"("anonymous_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_link" ADD CONSTRAINT "identity_link_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_anonymous_id_fkey" FOREIGN KEY ("anonymous_id") REFERENCES "visitor"("anonymous_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_anonymous_id_fkey" FOREIGN KEY ("anonymous_id") REFERENCES "visitor"("anonymous_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "session"("session_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funnel" ADD CONSTRAINT "funnel_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funnel" ADD CONSTRAINT "funnel_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funnel_version" ADD CONSTRAINT "funnel_version_funnel_id_fkey" FOREIGN KEY ("funnel_id") REFERENCES "funnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funnel_publication" ADD CONSTRAINT "funnel_publication_funnel_id_fkey" FOREIGN KEY ("funnel_id") REFERENCES "funnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funnel_step" ADD CONSTRAINT "funnel_step_funnel_version_id_fkey" FOREIGN KEY ("funnel_version_id") REFERENCES "funnel_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funnel_step_match" ADD CONSTRAINT "funnel_step_match_funnel_step_id_fkey" FOREIGN KEY ("funnel_step_id") REFERENCES "funnel_step"("id") ON DELETE CASCADE ON UPDATE CASCADE;
