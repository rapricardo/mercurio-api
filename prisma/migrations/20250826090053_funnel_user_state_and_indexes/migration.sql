-- CreateTable
CREATE TABLE "funnel_user_state" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "workspace_id" BIGINT NOT NULL,
    "funnel_id" BIGINT NOT NULL,
    "funnel_version_id" BIGINT NOT NULL,
    "anonymous_id" VARCHAR(50) NOT NULL,
    "lead_id" BIGINT,
    "current_step_id" BIGINT,
    "current_step_index" INTEGER,
    "entered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "exited_at" TIMESTAMP(3),
    "exit_step_index" INTEGER,
    "conversion_time_seconds" INTEGER,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "metadata" JSONB,

    CONSTRAINT "funnel_user_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "funnel_user_state_tenant_id_workspace_id_funnel_id_idx" ON "funnel_user_state"("tenant_id", "workspace_id", "funnel_id");

-- CreateIndex
CREATE INDEX "funnel_user_state_tenant_id_workspace_id_anonymous_id_idx" ON "funnel_user_state"("tenant_id", "workspace_id", "anonymous_id");

-- CreateIndex
CREATE INDEX "funnel_user_state_tenant_id_workspace_id_funnel_id_status_idx" ON "funnel_user_state"("tenant_id", "workspace_id", "funnel_id", "status");

-- CreateIndex
CREATE INDEX "funnel_user_state_tenant_id_workspace_id_funnel_id_last_act_idx" ON "funnel_user_state"("tenant_id", "workspace_id", "funnel_id", "last_activity_at");

-- CreateIndex
CREATE INDEX "funnel_user_state_funnel_id_current_step_index_status_idx" ON "funnel_user_state"("funnel_id", "current_step_index", "status");

-- CreateIndex
CREATE UNIQUE INDEX "funnel_user_state_tenant_id_workspace_id_funnel_id_anonymou_key" ON "funnel_user_state"("tenant_id", "workspace_id", "funnel_id", "anonymous_id");

-- AddForeignKey
ALTER TABLE "funnel_user_state" ADD CONSTRAINT "funnel_user_state_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funnel_user_state" ADD CONSTRAINT "funnel_user_state_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funnel_user_state" ADD CONSTRAINT "funnel_user_state_funnel_id_fkey" FOREIGN KEY ("funnel_id") REFERENCES "funnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funnel_user_state" ADD CONSTRAINT "funnel_user_state_anonymous_id_fkey" FOREIGN KEY ("anonymous_id") REFERENCES "visitor"("anonymous_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funnel_user_state" ADD CONSTRAINT "funnel_user_state_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
