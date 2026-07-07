-- IA — Central de prompts (Caderno §10 · P0-c). Prompt técnico por caso de uso,
-- editável/versionado em "Configurações de IA". Control plane (owner-only): sem
-- RLS — nunca acessado pelo role da aplicação. Sem linha = usa o padrão em código.
CREATE TABLE "ai_prompts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "useCase" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_prompts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ai_prompts_useCase_key" ON "ai_prompts"("useCase");
