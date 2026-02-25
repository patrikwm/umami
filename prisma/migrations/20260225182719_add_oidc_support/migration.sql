/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `user` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "user" ADD COLUMN     "email" VARCHAR(255),
ADD COLUMN     "email_verified" TIMESTAMPTZ(6),
ALTER COLUMN "password" DROP NOT NULL;

-- CreateTable
CREATE TABLE "account" (
    "account_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "provider_account_id" VARCHAR(255) NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" VARCHAR(50),
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "account_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "auth_session" (
    "auth_session_id" UUID NOT NULL,
    "session_token" VARCHAR(255) NOT NULL,
    "user_id" UUID NOT NULL,
    "expires" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "auth_session_pkey" PRIMARY KEY ("auth_session_id")
);

-- CreateTable
CREATE TABLE "verification_token" (
    "identifier" VARCHAR(255) NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "expires" TIMESTAMPTZ(6) NOT NULL
);

-- CreateTable
CREATE TABLE "oidc_provider" (
    "provider_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "issuer" VARCHAR(500) NOT NULL,
    "client_id" VARCHAR(255) NOT NULL,
    "client_secret" VARCHAR(500) NOT NULL,
    "auth_url" VARCHAR(500),
    "token_url" VARCHAR(500),
    "userinfo_url" VARCHAR(500),
    "scope" VARCHAR(500),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "auto_create" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "oidc_provider_pkey" PRIMARY KEY ("provider_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_account_id_key" ON "account"("account_id");

-- CreateIndex
CREATE INDEX "account_user_id_idx" ON "account"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_provider_provider_account_id_key" ON "account"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_session_auth_session_id_key" ON "auth_session"("auth_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_session_session_token_key" ON "auth_session"("session_token");

-- CreateIndex
CREATE INDEX "auth_session_user_id_idx" ON "auth_session"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_token_token_key" ON "verification_token"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_token_identifier_token_key" ON "verification_token"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "oidc_provider_provider_id_key" ON "oidc_provider"("provider_id");

-- CreateIndex
CREATE INDEX "oidc_provider_enabled_idx" ON "oidc_provider"("enabled");

-- CreateIndex
CREATE INDEX "oidc_provider_type_idx" ON "oidc_provider"("type");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");
