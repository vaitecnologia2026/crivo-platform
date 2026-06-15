-- Anexo Técnico ICD do Líder v1 §6–§9: substitui o ICD "4 Rs" (Assessment+IcdScore)
-- pelo modelo OFICIAL de 4 EIXOS (Clareza/Critério/Alinhamento/Sustentação)
-- aplicados a UMA decisão registrada. 1:1 com Decision via decisionId UNIQUE.
-- O modelo legado (icd_scores) permanece intacto para retrocompatibilidade.

-- CreateEnum
CREATE TYPE "IcdAxis" AS ENUM ('CLAREZA', 'CRITERIO', 'ALINHAMENTO', 'SUSTENTACAO');

-- CreateTable
CREATE TABLE "decision_icd_scores" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "decisionId" UUID NOT NULL,
    "leaderId" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "axes" JSONB NOT NULL,
    "answers" JSONB NOT NULL,
    "weight" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_icd_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "decision_icd_scores_decisionId_key" ON "decision_icd_scores"("decisionId");

-- CreateIndex
CREATE INDEX "decision_icd_scores_tenantId_idx" ON "decision_icd_scores"("tenantId");

-- CreateIndex
CREATE INDEX "decision_icd_scores_leaderId_idx" ON "decision_icd_scores"("leaderId");

-- CreateIndex
CREATE INDEX "decision_icd_scores_computedAt_idx" ON "decision_icd_scores"("computedAt");

-- AddForeignKey
ALTER TABLE "decision_icd_scores" ADD CONSTRAINT "decision_icd_scores_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_icd_scores" ADD CONSTRAINT "decision_icd_scores_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_icd_scores" ADD CONSTRAINT "decision_icd_scores_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
