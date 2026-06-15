-- Anexo Técnico ICD do Líder v1 §9.4–§9.6, §10, §11:
-- Janela trimestral oficial do ICD com fechamento (CLOSED) congelado, ICD
-- ponderado por líder (peso 1 médio / 2 alto), ICD da empresa (média dos
-- líderes elegíveis, NÃO média direta de decisões), e supressão <5 líderes.

-- CreateEnum
CREATE TYPE "IcdCycleStatus" AS ENUM ('OPEN', 'CLOSED');

-- AlterTable: liga avaliações de decisão ao ciclo trimestral em que caíram.
ALTER TABLE "decision_icd_scores" ADD COLUMN "cycleId" UUID;

-- CreateTable: §9.6 — ciclo trimestral por tenant.
CREATE TABLE "icd_cycles" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "quarter" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "IcdCycleStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "icd_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: §9.4 — ICD ponderado por líder no ciclo.
CREATE TABLE "leader_quarterly_icd" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "cycleId" UUID NOT NULL,
    "leaderId" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "decisionCount" INTEGER NOT NULL,
    "totalWeight" INTEGER NOT NULL,
    "axesAverage" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leader_quarterly_icd_pkey" PRIMARY KEY ("id")
);

-- CreateTable: §9.5 — ICD oficial da empresa no ciclo (sob supressão <5).
CREATE TABLE "company_quarterly_icd" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "cycleId" UUID NOT NULL,
    "score" INTEGER,
    "eligibleLeaders" INTEGER NOT NULL,
    "suppressed" BOOLEAN NOT NULL DEFAULT false,
    "distribution" JSONB NOT NULL,
    "axesAverage" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_quarterly_icd_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "decision_icd_scores_cycleId_idx" ON "decision_icd_scores"("cycleId");

-- CreateIndex
CREATE INDEX "icd_cycles_tenantId_idx" ON "icd_cycles"("tenantId");
CREATE INDEX "icd_cycles_status_idx" ON "icd_cycles"("status");
CREATE UNIQUE INDEX "icd_cycles_tenantId_year_quarter_key" ON "icd_cycles"("tenantId", "year", "quarter");

-- CreateIndex
CREATE INDEX "leader_quarterly_icd_tenantId_idx" ON "leader_quarterly_icd"("tenantId");
CREATE INDEX "leader_quarterly_icd_leaderId_idx" ON "leader_quarterly_icd"("leaderId");
CREATE UNIQUE INDEX "leader_quarterly_icd_cycleId_leaderId_key" ON "leader_quarterly_icd"("cycleId", "leaderId");

-- CreateIndex
CREATE UNIQUE INDEX "company_quarterly_icd_cycleId_key" ON "company_quarterly_icd"("cycleId");
CREATE INDEX "company_quarterly_icd_tenantId_idx" ON "company_quarterly_icd"("tenantId");

-- AddForeignKey
ALTER TABLE "decision_icd_scores" ADD CONSTRAINT "decision_icd_scores_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "icd_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "icd_cycles" ADD CONSTRAINT "icd_cycles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leader_quarterly_icd" ADD CONSTRAINT "leader_quarterly_icd_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leader_quarterly_icd" ADD CONSTRAINT "leader_quarterly_icd_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "icd_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leader_quarterly_icd" ADD CONSTRAINT "leader_quarterly_icd_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_quarterly_icd" ADD CONSTRAINT "company_quarterly_icd_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_quarterly_icd" ADD CONSTRAINT "company_quarterly_icd_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "icd_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
