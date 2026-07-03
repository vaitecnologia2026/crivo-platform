-- CRM Tela 02 (Instruções ao programador): responsável comercial, valor proposto,
-- proposta enviada e adicionais potenciais no lead. Todos nullable / default vazio.
ALTER TABLE "platform_leads" ADD COLUMN "commercialOwner" TEXT;
ALTER TABLE "platform_leads" ADD COLUMN "proposedValueCents" INTEGER;
ALTER TABLE "platform_leads" ADD COLUMN "proposalSentAt" TIMESTAMP(3);
ALTER TABLE "platform_leads" ADD COLUMN "potentialAddons" TEXT[] NOT NULL DEFAULT '{}';
