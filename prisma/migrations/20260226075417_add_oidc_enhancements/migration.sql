-- AlterTable
ALTER TABLE "oidc_provider" ADD COLUMN     "admin_group" VARCHAR(200),
ADD COLUMN     "sort_order" INTEGER,
ADD COLUMN     "team_mappings" JSONB,
ADD COLUMN     "trusted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "view_only_group" VARCHAR(200);

-- AlterTable
ALTER TABLE "team_user" ADD COLUMN     "source" VARCHAR(20) NOT NULL DEFAULT 'manual';

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "resource" VARCHAR(255),
    "metadata" JSONB,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_log_user_id_idx" ON "audit_log"("user_id");

-- CreateIndex
CREATE INDEX "audit_log_action_idx" ON "audit_log"("action");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");
