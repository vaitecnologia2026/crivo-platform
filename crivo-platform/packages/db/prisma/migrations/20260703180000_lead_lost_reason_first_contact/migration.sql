-- Motivo de perda estruturado + timestamp do 1º contato (dashboard: motivos de
-- perda + tempo médio de resposta). Ambos nullable, sem backfill.
ALTER TABLE "platform_leads" ADD COLUMN "lostReason" TEXT;
ALTER TABLE "platform_leads" ADD COLUMN "firstContactedAt" TIMESTAMP(3);
