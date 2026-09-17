-- Auditoria "Módulos (Super Admin) vs. protótipo Lovable" (17/09): a aba
-- Blueprints do protótipo mostra Esforço, Valor potencial e Parceiro por
-- blueprint e usa os status "Em revisão" / "Aprovado"; o texto da aba de
-- Pilotos fala em "suspende". Nada disso existia no modelo WorkPilot.
--
-- Puramente ADITIVA: 3 colunas TEXT nullable (nascem NULL para todo registro
-- já cadastrado — a UI mostra "—") e 3 valores novos no enum WorkPilotStatus
-- (os 3 existentes continuam válidos; nenhum registro muda de status).

ALTER TYPE "WorkPilotStatus" ADD VALUE IF NOT EXISTS 'EM_REVISAO';
ALTER TYPE "WorkPilotStatus" ADD VALUE IF NOT EXISTS 'APROVADO';
ALTER TYPE "WorkPilotStatus" ADD VALUE IF NOT EXISTS 'SUSPENSO';

ALTER TABLE "work_pilots" ADD COLUMN "effort" TEXT;
ALTER TABLE "work_pilots" ADD COLUMN "potential_value" TEXT;
ALTER TABLE "work_pilots" ADD COLUMN "partner" TEXT;
