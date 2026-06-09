-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('NOVO', 'CONTATO', 'QUALIFICADO', 'PROPOSTA', 'GANHO', 'PERDIDO');

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT,
    "whatsapp" TEXT,
    "segment" TEXT,
    "origin" TEXT,
    "stage" "LeadStage" NOT NULL DEFAULT 'NOVO',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leads_tenantId_idx" ON "leads"("tenantId");

-- CreateIndex
CREATE INDEX "leads_tenantId_stage_idx" ON "leads"("tenantId", "stage");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
