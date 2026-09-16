-- Governança de IA (módulo 'govia' — Programas › Governança de IA).
--
-- Serviço contratado pelo CLIENTE para governar as PRÓPRIAS IAs: inventário
-- de casos de uso (código IA-NN sequencial por empresa), risco inerente e
-- residual (julgamento do cliente — avaliação não certificadora, sem motor
-- CRIVO), decisão humana com justificativa OBRIGATÓRIA e trilha própria,
-- vínculos com Evidências / Plano de Evolução, incidentes, políticas e agenda
-- de revisão (derivada de next_review_at — não é tabela).
--
-- Nada aqui toca ai_settings / ai_prompts (control plane, que configuram o
-- motor CRIVO). O Super Admin (Módulos › Governança de IA) LÊ estas tabelas
-- com tenantId explícito e não escreve.
--
-- Puramente ADITIVA: cinco tabelas novas que nascem vazias + a permissão
-- govia:manage no catálogo RBAC (idempotente, espelha ROLE_PERMISSIONS).
--
-- Migration escrita à MÃO (padrão do repo): `prisma migrate dev` quebra (P3006)
-- porque a shadow DB não tem current_tenant(). Usar `prisma migrate deploy`.

CREATE TYPE "AiRiskLevel" AS ENUM ('ALTO', 'MEDIO', 'BAIXO');
CREATE TYPE "AiUseCaseStatus" AS ENUM ('RASCUNHO', 'EM_AVALIACAO', 'APROVADO', 'CONDICIONADO', 'RESTRITO', 'REJEITADO');
CREATE TYPE "AiDecision" AS ENUM ('APROVAR', 'CONDICIONAR', 'RESTRINGIR', 'REJEITAR');
CREATE TYPE "AiLinkKind" AS ENUM ('EVIDENCE', 'ACTION_ITEM', 'WORKFORCE');
CREATE TYPE "AiIncidentSeverity" AS ENUM ('ALTA', 'MEDIA', 'BAIXA');
CREATE TYPE "AiIncidentStatus" AS ENUM ('ABERTO', 'ENCERRADO');
CREATE TYPE "AiPolicyStatus" AS ENUM ('RASCUNHO', 'EM_REVISAO', 'APROVADO');

-- 1) Casos de uso (inventário)
CREATE TABLE "ai_use_cases" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "owner_name" TEXT NOT NULL,
    "owner_user_id" UUID,
    "technology" TEXT NOT NULL,
    "vendor" TEXT,
    "data_used" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "inherent_risk" "AiRiskLevel" NOT NULL,
    "residual_risk" "AiRiskLevel" NOT NULL,
    "controls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" "AiUseCaseStatus" NOT NULL DEFAULT 'RASCUNHO',
    "justification" TEXT,
    "next_review_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_use_cases_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ai_use_cases_tenantId_fkey" FOREIGN KEY ("tenantId")
      REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ai_use_cases_tenantId_code_key" ON "ai_use_cases"("tenantId", "code");
CREATE INDEX "ai_use_cases_tenantId_idx" ON "ai_use_cases"("tenantId");
CREATE INDEX "ai_use_cases_tenantId_status_idx" ON "ai_use_cases"("tenantId", "status");

-- 2) Trilha da decisão humana (append-only por desenho: o service só insere)
CREATE TABLE "ai_use_case_decisions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "use_case_id" UUID NOT NULL,
    "decision" "AiDecision" NOT NULL,
    "justification" TEXT NOT NULL,
    "decided_by_user_id" UUID NOT NULL,
    "decided_by_name" TEXT NOT NULL,
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_use_case_decisions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ai_use_case_decisions_tenantId_fkey" FOREIGN KEY ("tenantId")
      REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ai_use_case_decisions_use_case_id_fkey" FOREIGN KEY ("use_case_id")
      REFERENCES "ai_use_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ai_use_case_decisions_tenantId_idx" ON "ai_use_case_decisions"("tenantId");
CREATE INDEX "ai_use_case_decisions_use_case_id_idx" ON "ai_use_case_decisions"("use_case_id");

-- 3) Vínculos (Evidence / ActionItem / WorkTask futura). Sem FK ao alvo de
--    propósito: apagar a evidência não pode apagar o caso; o service resolve
--    o título e devolve null quando o alvo sumiu.
CREATE TABLE "ai_use_case_links" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "use_case_id" UUID NOT NULL,
    "kind" "AiLinkKind" NOT NULL,
    "target_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_use_case_links_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ai_use_case_links_tenantId_fkey" FOREIGN KEY ("tenantId")
      REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ai_use_case_links_use_case_id_fkey" FOREIGN KEY ("use_case_id")
      REFERENCES "ai_use_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ai_use_case_links_use_case_id_kind_target_id_key"
  ON "ai_use_case_links"("use_case_id", "kind", "target_id");
CREATE INDEX "ai_use_case_links_tenantId_idx" ON "ai_use_case_links"("tenantId");

-- 4) Incidentes
CREATE TABLE "ai_incidents" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "use_case_id" UUID,
    "severity" "AiIncidentSeverity" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "AiIncidentStatus" NOT NULL DEFAULT 'ABERTO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_incidents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ai_incidents_tenantId_fkey" FOREIGN KEY ("tenantId")
      REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ai_incidents_use_case_id_fkey" FOREIGN KEY ("use_case_id")
      REFERENCES "ai_use_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "ai_incidents_tenantId_idx" ON "ai_incidents"("tenantId");
CREATE INDEX "ai_incidents_use_case_id_idx" ON "ai_incidents"("use_case_id");

-- 5) Políticas / documentos
CREATE TABLE "ai_policies" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "AiPolicyStatus" NOT NULL DEFAULT 'RASCUNHO',
    "published_at" TIMESTAMP(3),
    "url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_policies_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ai_policies_tenantId_fkey" FOREIGN KEY ("tenantId")
      REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ai_policies_tenantId_idx" ON "ai_policies"("tenantId");

-- RLS: data plane isolado por tenant (mesmo padrão de collaborators). O
-- portal escreve via forTenant (crivo_app); o Super Admin lê via forTenant
-- com o organizationId resolvido de Tenant.id.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ai_use_cases','ai_use_case_decisions','ai_use_case_links','ai_incidents','ai_policies'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING ("tenantId" = current_tenant())
         WITH CHECK ("tenantId" = current_tenant());',
      t
    );
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crivo_app') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO crivo_app;', t);
    END IF;
  END LOOP;
END
$$;

-- 6) Catálogo RBAC (dados) — IDEMPOTENTE, espelha PERMISSIONS/ROLE_PERMISSIONS
--    de @crivo/types: govia:manage para RH, ADMIN, CEO e GESTOR (escrita no
--    inventário, decisão humana, incidentes e políticas). A leitura é por papel
--    (@Roles), não por permissão. Substitui rodar o seed em produção.
INSERT INTO "permissions" ("id", "code", "module", "action", "label") VALUES
  (gen_random_uuid(), 'govia:manage', 'govia', 'manage', 'Gerir Governança de IA')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permId")
SELECT r."id", p."id"
FROM (VALUES
  ('ADMIN','govia:manage'),
  ('CEO','govia:manage'),
  ('GESTOR','govia:manage'),
  ('RH','govia:manage')
) AS m("role_code", "perm_code")
JOIN "role_defs" r ON r."code" = m."role_code"
JOIN "permissions" p ON p."code" = m."perm_code"
ON CONFLICT DO NOTHING;
