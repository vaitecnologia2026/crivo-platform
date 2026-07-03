-- Grupo Empresarial (F1 · Caderno Tela 06 — Grupo → CNPJ → Unidade).
-- Control plane (owner-only): sem RLS — nunca acessado pelo role da aplicação.

-- CreateTable
CREATE TABLE "business_groups" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_groups_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "groupId" UUID;

-- CreateIndex
CREATE INDEX "tenants_groupId_idx" ON "tenants"("groupId");
