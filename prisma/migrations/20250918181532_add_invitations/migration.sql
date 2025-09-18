-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELED');

-- CreateTable
CREATE TABLE "user_profile" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" VARCHAR(255),
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "user_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_workspace_access" (
    "id" BIGSERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "workspace_id" BIGINT NOT NULL,
    "role" VARCHAR(50) NOT NULL DEFAULT 'viewer',
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "granted_by" TEXT,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "user_workspace_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT NOT NULL,
    "accepted_by_id" TEXT,

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_profile_email_key" ON "user_profile"("email");

-- CreateIndex
CREATE INDEX "user_workspace_access_user_id_idx" ON "user_workspace_access"("user_id");

-- CreateIndex
CREATE INDEX "user_workspace_access_tenant_id_workspace_id_idx" ON "user_workspace_access"("tenant_id", "workspace_id");

-- CreateIndex
CREATE INDEX "user_workspace_access_tenant_id_workspace_id_role_idx" ON "user_workspace_access"("tenant_id", "workspace_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "user_workspace_access_user_id_tenant_id_workspace_id_key" ON "user_workspace_access"("user_id", "tenant_id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "invitation_token_key" ON "invitation"("token");

-- CreateIndex
CREATE INDEX "invitation_tenant_id_idx" ON "invitation"("tenant_id");

-- CreateIndex
CREATE INDEX "invitation_token_idx" ON "invitation"("token");

-- CreateIndex
CREATE INDEX "invitation_email_idx" ON "invitation"("email");

-- CreateIndex
CREATE INDEX "invitation_expires_at_idx" ON "invitation"("expires_at");

-- CreateIndex
CREATE INDEX "invitation_status_idx" ON "invitation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "invitation_tenant_id_email_status_key" ON "invitation"("tenant_id", "email", "status");

-- AddForeignKey
ALTER TABLE "user_workspace_access" ADD CONSTRAINT "user_workspace_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_workspace_access" ADD CONSTRAINT "user_workspace_access_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_workspace_access" ADD CONSTRAINT "user_workspace_access_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_accepted_by_id_fkey" FOREIGN KEY ("accepted_by_id") REFERENCES "user_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
