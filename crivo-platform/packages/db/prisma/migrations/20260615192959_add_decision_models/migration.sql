-- CreateEnum
CREATE TYPE "DecisionImpact" AS ENUM ('BAIXO', 'MEDIO', 'ALTO');

-- CreateEnum
CREATE TYPE "DecisionType" AS ENUM ('INDIVIDUAL', 'COLETIVA', 'RECOMENDACAO_APROVACAO', 'COMPARTILHADA');

-- CreateEnum
CREATE TYPE "DecisionPocketUse" AS ENUM ('NAO_UTILIZADO', 'ANTES', 'DURANTE');

-- CreateEnum
CREATE TYPE "DecisionPressureFactor" AS ENUM ('URGENCIA', 'CONFLITO', 'FALTA_INFORMACAO', 'PRESSAO_RESULTADO', 'RISCO_FINANCEIRO', 'RISCO_PESSOAS', 'RISCO_JURIDICO', 'EXPOSICAO_REPUTACIONAL', 'OUTRO');

-- CreateEnum
CREATE TYPE "DecisionRevisionPeriod" AS ENUM ('D30', 'D60', 'D90', 'SEM_REVISAO');

-- CreateEnum
CREATE TYPE "DecisionStatus" AS ENUM ('EM_REGISTRO', 'REGISTRADA', 'AVALIADA_PELO_ICD');

-- CreateTable
CREATE TABLE "decision_categories" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affected_audiences" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affected_audiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decisions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "leaderId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" UUID,
    "impact" "DecisionImpact" NOT NULL,
    "type" "DecisionType" NOT NULL,
    "pocketUse" "DecisionPocketUse" NOT NULL DEFAULT 'NAO_UTILIZADO',
    "pressureFactor" "DecisionPressureFactor",
    "revisionPeriod" "DecisionRevisionPeriod" NOT NULL DEFAULT 'SEM_REVISAO',
    "status" "DecisionStatus" NOT NULL DEFAULT 'EM_REGISTRO',
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_audiences" (
    "decisionId" UUID NOT NULL,
    "audienceId" UUID NOT NULL,

    CONSTRAINT "decision_audiences_pkey" PRIMARY KEY ("decisionId","audienceId")
);

-- CreateTable
CREATE TABLE "sustentation_actions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "decisionId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "responsible" TEXT NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "expectedResult" TEXT,
    "evidenceUrl" TEXT,
    "status" "ActionStatus" NOT NULL DEFAULT 'SUGERIDA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sustentation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "decision_categories_tenantId_idx" ON "decision_categories"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "decision_categories_tenantId_slug_key" ON "decision_categories"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "affected_audiences_tenantId_idx" ON "affected_audiences"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "affected_audiences_tenantId_slug_key" ON "affected_audiences"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "decisions_tenantId_idx" ON "decisions"("tenantId");

-- CreateIndex
CREATE INDEX "decisions_leaderId_idx" ON "decisions"("leaderId");

-- CreateIndex
CREATE INDEX "decisions_decidedAt_idx" ON "decisions"("decidedAt");

-- CreateIndex
CREATE INDEX "decision_audiences_audienceId_idx" ON "decision_audiences"("audienceId");

-- CreateIndex
CREATE UNIQUE INDEX "sustentation_actions_decisionId_key" ON "sustentation_actions"("decisionId");

-- CreateIndex
CREATE INDEX "sustentation_actions_tenantId_idx" ON "sustentation_actions"("tenantId");

-- CreateIndex
CREATE INDEX "sustentation_actions_decisionId_idx" ON "sustentation_actions"("decisionId");

-- AddForeignKey
ALTER TABLE "decision_categories" ADD CONSTRAINT "decision_categories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affected_audiences" ADD CONSTRAINT "affected_audiences_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "decision_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_audiences" ADD CONSTRAINT "decision_audiences_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_audiences" ADD CONSTRAINT "decision_audiences_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "affected_audiences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sustentation_actions" ADD CONSTRAINT "sustentation_actions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sustentation_actions" ADD CONSTRAINT "sustentation_actions_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

