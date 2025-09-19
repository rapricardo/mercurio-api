-- DropForeignKey
ALTER TABLE "invitation" DROP CONSTRAINT "invitation_created_by_id_fkey";

-- DropIndex
DROP INDEX "invitation_tenant_id_email_status_key";

-- AlterTable
ALTER TABLE "invitation" ALTER COLUMN "created_by_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
