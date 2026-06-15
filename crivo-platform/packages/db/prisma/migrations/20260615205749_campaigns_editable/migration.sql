-- Análise Preliminar Portal §7: campanhas editáveis pelo RH/CEO.
-- Adiciona description, sector (área alvo), publicSlug (link público sem auth),
-- janela startsAt/endsAt, reminderAt (e idempotência reminderSentAt) e
-- timestamps de auditoria (updatedAt + closedAt no fechamento).

ALTER TABLE "assessment_cycles"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "sector" TEXT,
  ADD COLUMN "publicSlug" TEXT,
  ADD COLUMN "startsAt" TIMESTAMP(3),
  ADD COLUMN "endsAt" TIMESTAMP(3),
  ADD COLUMN "reminderAt" TIMESTAMP(3),
  ADD COLUMN "reminderSentAt" TIMESTAMP(3),
  ADD COLUMN "closedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "assessment_cycles_publicSlug_key" ON "assessment_cycles"("publicSlug");
CREATE INDEX "assessment_cycles_sector_idx" ON "assessment_cycles"("sector");
