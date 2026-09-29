-- H-009 (decisão CRIVO 28/09/2026): validação do Plano e emissão do Dossiê
-- registram usuário, papel, data/hora, versão e auditoria. Sem assinatura
-- certificada na V1.
--
-- ADITIVA: colunas novas NULL (ou 0). Planos já validados ficam com versão 1
-- (a validação que já existe) e sem papel/id — o nome em validatedBy continua.
ALTER TABLE "action_plans" ADD COLUMN "validated_by_user_id" UUID;
ALTER TABLE "action_plans" ADD COLUMN "validated_by_role" TEXT;
ALTER TABLE "action_plans" ADD COLUMN "validation_version" INTEGER NOT NULL DEFAULT 0;
UPDATE "action_plans" SET "validation_version" = 1 WHERE "validatedAt" IS NOT NULL;

ALTER TABLE "report_emissions" ADD COLUMN "generated_by_user_id" UUID;
ALTER TABLE "report_emissions" ADD COLUMN "generated_by_role" TEXT;
