-- F3: Consolidado do Grupo no portal do cliente (Caderno Tela 06).
-- Control plane (owner-only): sem RLS.

-- AlterTable: flag "consolidado autorizado" no grupo.
ALTER TABLE "business_groups" ADD COLUMN "consolidatedEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: e-mails autorizados a ver o consolidado do grupo no portal.
CREATE TABLE "business_group_access" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_group_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_group_access_groupId_email_key" ON "business_group_access"("groupId", "email");

-- CreateIndex
CREATE INDEX "business_group_access_email_idx" ON "business_group_access"("email");
