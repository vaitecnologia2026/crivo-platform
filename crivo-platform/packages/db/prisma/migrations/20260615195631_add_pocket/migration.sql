-- Anexo Técnico Pocket CRIVO v1: módulo de Liderança/App que prepara o líder
-- ANTES ou DURANTE decisões via 10 perguntas reflexivas (C1-O2) nas 5 dimensões
-- CRIVO. NÃO gera score (§6), é apoio metacognitivo. Vínculo opcional com Decision.

-- CreateEnum
CREATE TYPE "PocketMomentOfUse" AS ENUM ('AVULSO', 'ANTES_DECISAO', 'DURANTE_DECISAO');

-- CreateEnum
CREATE TYPE "PocketSessionStatus" AS ENUM ('EM_ANDAMENTO', 'CONCLUIDA');

-- CreateTable: §5/§12 — sessão Pocket do líder.
CREATE TABLE "pocket_sessions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "leaderId" UUID NOT NULL,
    "context" TEXT,
    "momentOfUse" "PocketMomentOfUse" NOT NULL DEFAULT 'AVULSO',
    "decisionId" UUID,
    "status" "PocketSessionStatus" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "questionsVersion" TEXT NOT NULL DEFAULT 'v1',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pocket_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: §7/§12 — reflexão a uma das 10 perguntas.
CREATE TABLE "pocket_reflections" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "questionCode" TEXT NOT NULL,
    "text" TEXT,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pocket_reflections_pkey" PRIMARY KEY ("id")
);

-- CreateTable: §7/§10 — síntese da Mentoria IA (opcional, 1:1 com sessão).
CREATE TABLE "pocket_ai_summaries" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "synthesis" TEXT NOT NULL,
    "recommendation" TEXT,
    "nextStep" TEXT,
    "modelVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pocket_ai_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pocket_sessions_tenantId_idx" ON "pocket_sessions"("tenantId");
CREATE INDEX "pocket_sessions_leaderId_idx" ON "pocket_sessions"("leaderId");
CREATE INDEX "pocket_sessions_decisionId_idx" ON "pocket_sessions"("decisionId");

-- CreateIndex
CREATE INDEX "pocket_reflections_tenantId_idx" ON "pocket_reflections"("tenantId");
CREATE UNIQUE INDEX "pocket_reflections_sessionId_questionCode_key" ON "pocket_reflections"("sessionId", "questionCode");

-- CreateIndex
CREATE UNIQUE INDEX "pocket_ai_summaries_sessionId_key" ON "pocket_ai_summaries"("sessionId");
CREATE INDEX "pocket_ai_summaries_tenantId_idx" ON "pocket_ai_summaries"("tenantId");

-- AddForeignKey
ALTER TABLE "pocket_sessions" ADD CONSTRAINT "pocket_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pocket_sessions" ADD CONSTRAINT "pocket_sessions_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pocket_sessions" ADD CONSTRAINT "pocket_sessions_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "decisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pocket_reflections" ADD CONSTRAINT "pocket_reflections_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pocket_reflections" ADD CONSTRAINT "pocket_reflections_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "pocket_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pocket_ai_summaries" ADD CONSTRAINT "pocket_ai_summaries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pocket_ai_summaries" ADD CONSTRAINT "pocket_ai_summaries_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "pocket_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
