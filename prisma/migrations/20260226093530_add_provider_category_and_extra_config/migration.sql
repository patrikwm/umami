-- AlterTable
ALTER TABLE "oidc_provider" ADD COLUMN     "category" VARCHAR(50) DEFAULT 'oidc',
ADD COLUMN     "extra_config" JSONB;

-- CreateIndex
CREATE INDEX "oidc_provider_category_idx" ON "oidc_provider"("category");
