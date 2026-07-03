-- CRM Tela 02: solução de interesse (pré-venda) + follow-up (próxima ação).
-- Todos nullable, sem backfill.
ALTER TABLE "platform_leads" ADD COLUMN "interestProductId" UUID;
ALTER TABLE "platform_leads" ADD COLUMN "nextActionAt" TIMESTAMP(3);
ALTER TABLE "platform_leads" ADD COLUMN "nextActionNote" TEXT;
