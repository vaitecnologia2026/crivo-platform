-- Núcleo product-driven (diretriz estrutural 2026-06):
--   products       → catálogo comercial (tudo nasce de um produto)
--   platform_leads → CRM do super admin (funil comercial da CRIVO)
-- Ambos são CONTROL PLANE (owner-only). A revogação de crivo_app é aplicada
-- por prisma/sql/rls.sql (ctrl_tables) — rodar rls.sql após o deploy desta migration.

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PlatformLeadStage" AS ENUM ('NOVO', 'PRE_DIAGNOSTICO', 'REUNIAO', 'PROPOSTA', 'FECHADO', 'PERDIDO');

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "plan" "Plan",
    "monthlyPriceCents" INTEGER NOT NULL DEFAULT 0,
    "setupPriceCents" INTEGER NOT NULL DEFAULT 0,
    "maxUsers" INTEGER NOT NULL DEFAULT 0,
    "maxLeaders" INTEGER NOT NULL DEFAULT 0,
    "companyType" TEXT,
    "modules" JSONB NOT NULL DEFAULT '[]',
    "diagnostic" JSONB,
    "aiConfig" JSONB,
    "isLeadCapture" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateTable
CREATE TABLE "platform_leads" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "segment" TEXT,
    "employeesCount" TEXT,
    "origin" TEXT,
    "productId" UUID,
    "diagnosticScore" INTEGER,
    "diagnosticResult" JSONB,
    "stage" "PlatformLeadStage" NOT NULL DEFAULT 'NOVO',
    "notes" TEXT,
    "convertedTenantId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_leads_stage_idx" ON "platform_leads"("stage");

-- CreateIndex
CREATE INDEX "platform_leads_createdAt_idx" ON "platform_leads"("createdAt");
