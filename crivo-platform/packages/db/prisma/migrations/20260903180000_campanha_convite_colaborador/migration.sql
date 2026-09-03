-- Campanha × coleta: até aqui os dois subsistemas não se falavam.
--
-- O convite ao colaborador saía apenas por existir cadastro importado, sem
-- pertencer a campanha nenhuma, e NENHUMA resposta guardava o ciclo — nem as
-- feitas pelo link da própria campanha. Resultado: a tela "Campanhas de
-- Diagnóstico" prometia "baseline e evolução por ciclo" medindo outra coisa
-- (as avaliações de líderes do ICD, divididas por todos os usuários ativos).
--
-- `campaign_invites` liga colaborador ↔ campanha e passa a carregar o token do
-- link /r/<token>. Um convite por (ciclo, colaborador): a mesma pessoa pode ser
-- convidada de novo em outra campanha, com token próprio, sem apagar o histórico
-- da anterior — é o que torna a evolução por ciclo mensurável.
--
-- Migration escrita à MÃO (padrão do repo): `prisma migrate dev` quebra (P3006)
-- porque a shadow DB não tem current_tenant(). Usar `prisma migrate deploy`.
CREATE TABLE "campaign_invites" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "collaborator_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "sent_email_at" TIMESTAMP(3),
    "sent_whatsapp_at" TIMESTAMP(3),
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "campaign_invites_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "campaign_invites_tenant_id_fkey" FOREIGN KEY ("tenant_id")
      REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "campaign_invites_cycle_id_fkey" FOREIGN KEY ("cycle_id")
      REFERENCES "assessment_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "campaign_invites_collaborator_id_fkey" FOREIGN KEY ("collaborator_id")
      REFERENCES "collaborators"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "campaign_invites_token_key" ON "campaign_invites"("token");
CREATE UNIQUE INDEX "campaign_invites_cycle_id_collaborator_id_key"
  ON "campaign_invites"("cycle_id", "collaborator_id");
CREATE INDEX "campaign_invites_tenant_id_idx" ON "campaign_invites"("tenant_id");
CREATE INDEX "campaign_invites_cycle_id_idx" ON "campaign_invites"("cycle_id");

-- RLS: data plane isolado por tenant (mesmo padrão de collaborators). A
-- resolução do token é PÚBLICA (sem sessão) e roda pela conexão owner com
-- `// rls-allow:` — o token é a própria credencial do respondente.
ALTER TABLE "campaign_invites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "campaign_invites" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "campaign_invites"
  USING ("tenant_id" = current_tenant()) WITH CHECK ("tenant_id" = current_tenant());
GRANT SELECT, INSERT, UPDATE, DELETE ON "campaign_invites" TO crivo_app;

-- A resposta passa a saber de qual campanha veio. Nullable: coleta avulsa (link
-- aberto, autoavaliação do gestor) continua válida e fica sem ciclo.
ALTER TABLE "psychosocial_responses" ADD COLUMN "cycle_id" UUID;
ALTER TABLE "psychosocial_responses" ADD CONSTRAINT "psychosocial_responses_cycle_id_fkey"
  FOREIGN KEY ("cycle_id") REFERENCES "assessment_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "psychosocial_responses_cycle_id_idx" ON "psychosocial_responses"("cycle_id");

ALTER TABLE "diagnostic_responses" ADD COLUMN "cycle_id" UUID;
ALTER TABLE "diagnostic_responses" ADD CONSTRAINT "diagnostic_responses_cycle_id_fkey"
  FOREIGN KEY ("cycle_id") REFERENCES "assessment_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "diagnostic_responses_cycle_id_idx" ON "diagnostic_responses"("cycle_id");
