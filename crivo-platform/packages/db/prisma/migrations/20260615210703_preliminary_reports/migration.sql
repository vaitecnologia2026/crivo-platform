-- Relatório Preliminar CRIVO (Briefing §5, Portal §7) — control plane.
-- Conteúdo gerado por IA (mesmo provider do Copiloto, via AiSettings) a partir
-- de um PlatformLead com diagnóstico inicial. Envio por e-mail é best-effort
-- (graceful fallback). Sem RLS — pertence ao funil do super admin.

-- CreateEnum
CREATE TYPE "PreliminaryReportStatus" AS ENUM ('GERANDO', 'PRONTO', 'ENVIADO', 'ERRO');

-- CreateTable
CREATE TABLE "preliminary_reports" (
    "id" UUID NOT NULL,
    "platformLeadId" UUID NOT NULL,
    "diagnosticScore" INTEGER NOT NULL,
    "diagnosticLevel" TEXT NOT NULL,
    "diagnosticDimensions" JSONB NOT NULL,
    "topAttention" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL DEFAULT 'v1',
    "status" "PreliminaryReportStatus" NOT NULL DEFAULT 'GERANDO',
    "errorReason" TEXT,
    "sentTo" TEXT,
    "sentAt" TIMESTAMP(3),
    "emailProvider" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "preliminary_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "preliminary_reports_platformLeadId_idx" ON "preliminary_reports"("platformLeadId");
CREATE INDEX "preliminary_reports_status_idx" ON "preliminary_reports"("status");
