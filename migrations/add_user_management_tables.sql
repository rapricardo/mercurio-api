-- Migration: Add User Management Tables
-- Date: 2025-01-03
-- Description: Create user_profile and user_workspace_access tables for Supabase integration

-- CreateTable: user_profile
CREATE TABLE "user_profile" (
    "id" TEXT NOT NULL,  -- Supabase UUID
    "email" TEXT NOT NULL,
    "name" VARCHAR(255),
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "user_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable: user_workspace_access
CREATE TABLE "user_workspace_access" (
    "id" BIGSERIAL NOT NULL,
    "user_id" TEXT NOT NULL,  -- Supabase UUID
    "tenant_id" BIGINT NOT NULL,
    "workspace_id" BIGINT NOT NULL,
    "role" VARCHAR(50) NOT NULL DEFAULT 'viewer',  -- admin, editor, viewer
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "granted_by" TEXT,  -- Supabase UUID of granter
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "user_workspace_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique email for user_profile
CREATE UNIQUE INDEX "user_profile_email_key" ON "user_profile"("email");

-- CreateIndex: Unique user+tenant+workspace combination
CREATE UNIQUE INDEX "user_workspace_access_user_id_tenant_id_workspace_id_key" 
    ON "user_workspace_access"("user_id", "tenant_id", "workspace_id");

-- CreateIndex: Performance indexes for user_workspace_access
CREATE INDEX "user_workspace_access_user_id_idx" ON "user_workspace_access"("user_id");
CREATE INDEX "user_workspace_access_tenant_id_workspace_id_idx" ON "user_workspace_access"("tenant_id", "workspace_id");
CREATE INDEX "user_workspace_access_tenant_id_workspace_id_role_idx" ON "user_workspace_access"("tenant_id", "workspace_id", "role");

-- AddForeignKey: user_workspace_access -> user_profile
ALTER TABLE "user_workspace_access" 
    ADD CONSTRAINT "user_workspace_access_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: user_workspace_access -> tenant
ALTER TABLE "user_workspace_access" 
    ADD CONSTRAINT "user_workspace_access_tenant_id_fkey" 
    FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: user_workspace_access -> workspace
ALTER TABLE "user_workspace_access" 
    ADD CONSTRAINT "user_workspace_access_workspace_id_fkey" 
    FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Update trigger for updated_at in user_profile
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_profile_updated_at 
    BEFORE UPDATE ON "user_profile" 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();