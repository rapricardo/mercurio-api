-- Migration: Add workspace_id to invitations table
-- This migration adds workspace_id column to enable proper workspace isolation for invitations

-- Step 1: Add the workspace_id column (nullable initially to handle existing data)
ALTER TABLE "invitation" ADD COLUMN "workspace_id" BIGINT;

-- Step 2: Set workspace_id for existing invitations
-- For existing invitations, we'll set workspace_id to the first workspace of the tenant
-- This is a safe default since most tenants likely have one workspace initially
UPDATE "invitation" 
SET "workspace_id" = (
    SELECT "id" 
    FROM "workspace" 
    WHERE "workspace"."tenant_id" = "invitation"."tenant_id" 
    ORDER BY "workspace"."created_at" ASC 
    LIMIT 1
)
WHERE "workspace_id" IS NULL;

-- Step 3: Make workspace_id NOT NULL now that all rows have values
ALTER TABLE "invitation" ALTER COLUMN "workspace_id" SET NOT NULL;

-- Step 4: Add foreign key constraint to workspace
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_workspace_id_fkey" 
    FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 5: Drop the old unique constraint (check actual constraint name)
ALTER TABLE "invitation" DROP CONSTRAINT IF EXISTS "invitation_tenant_id_email_status_key";
ALTER TABLE "invitation" DROP CONSTRAINT IF EXISTS "invitation_tenantId_email_status_key";

-- Step 6: Add new unique constraint including workspace_id
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_tenant_id_workspace_id_email_status_key" 
    UNIQUE ("tenant_id", "workspace_id", "email", "status");

-- Step 7: Add index for workspace_id for better query performance
CREATE INDEX "invitation_workspace_id_idx" ON "invitation"("workspace_id");

-- Step 8: Add composite index for tenant_id and workspace_id
CREATE INDEX "invitation_tenant_id_workspace_id_idx" ON "invitation"("tenant_id", "workspace_id");