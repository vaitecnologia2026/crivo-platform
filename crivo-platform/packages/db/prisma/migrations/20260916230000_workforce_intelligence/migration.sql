-- Workforce Intelligence (módulo 'workforce' — Programas › Workforce Intelligence).
--
-- Como o trabalho está organizado (processos, funções, tarefas, skills) e como
-- pode ser redesenhado entre pessoas, processos e IA. Os percentuais
-- (potencial IA, essencialidade humana, prontidão) são JULGAMENTOS informados
-- por quem mapeou — nunca score CRIVO nem cálculo de IA. Fluxo da tarefa:
-- cadastro → EM_VALIDACAO_CRIVO → VALIDADO_CRIVO (Super Admin, nota
-- obrigatória) → DECIDIDO (decisão humana do cliente no portal, com quem e
-- quando). O módulo não decide contratação/desligamento nem promete economia.
--
-- A "cobertura de IA" de um processo é derivada: % de tarefas com
-- ai_potential ≥ ai_threshold_pct DO PROCESSO (60 é só o default do campo).
--
-- Puramente ADITIVA: quatro tabelas novas que nascem vazias + a permissão
-- workforce:manage no catálogo RBAC (idempotente, espelha ROLE_PERMISSIONS).
--
-- Migration escrita à MÃO (padrão do repo): `prisma migrate dev` quebra (P3006)
-- porque a shadow DB não tem current_tenant(). Usar `prisma migrate deploy`.

CREATE TYPE "WorkCriticality" AS ENUM ('ALTA', 'MEDIA', 'BAIXA');
CREATE TYPE "WorkRisk" AS ENUM ('ALTO', 'MEDIO', 'BAIXO');
CREATE TYPE "WorkScenario" AS ENUM ('MANTER_HUMANO', 'REDESENHAR_PROCESSO', 'CAPACITAR', 'AUTOMATIZAR_PARTE', 'COPILOTO', 'AGENTE_SUPERVISIONADO', 'NAO_RECOMENDAR_IA');
CREATE TYPE "InsightOrigin" AS ENUM ('FATO', 'INFERENCIA', 'HIPOTESE', 'RECOMENDACAO');
CREATE TYPE "WorkTaskStage" AS ENUM ('RASCUNHO', 'EM_VALIDACAO_CRIVO', 'VALIDADO_CRIVO', 'DECIDIDO');
CREATE TYPE "WorkDecision" AS ENUM ('ACEITAR', 'CONDICIONAR', 'DEVOLVER', 'REJEITAR');
CREATE TYPE "WorkPilotKind" AS ENUM ('BLUEPRINT', 'PILOTO');
CREATE TYPE "WorkConfidence" AS ENUM ('ALTA', 'MEDIA', 'BAIXA');
CREATE TYPE "WorkPilotStatus" AS ENUM ('EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO');

-- 1) Processos mapeados (limiar de cobertura de IA por processo)
CREATE TABLE "work_processes" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "unit_id" UUID,
    "ai_threshold_pct" INTEGER NOT NULL DEFAULT 60,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "work_processes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "work_processes_tenantId_fkey" FOREIGN KEY ("tenantId")
      REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "work_processes_tenantId_idx" ON "work_processes"("tenantId");

-- 2) Tarefas do trabalho real (código T-NN por empresa; validação CRIVO e
--    decisão do cliente na própria linha — a história vai para audit_log)
CREATE TABLE "work_tasks" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "process_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "output" TEXT NOT NULL,
    "volume_per_month" INTEGER NOT NULL,
    "duration_min" INTEGER NOT NULL,
    "criticality" "WorkCriticality" NOT NULL,
    "ai_potential" INTEGER NOT NULL,
    "human_essentiality" INTEGER NOT NULL,
    "risk" "WorkRisk" NOT NULL,
    "readiness" INTEGER NOT NULL,
    "scenario" "WorkScenario" NOT NULL,
    "origin" "InsightOrigin" NOT NULL,
    "stage" "WorkTaskStage" NOT NULL DEFAULT 'RASCUNHO',
    "validation_note" TEXT,
    "validated_at" TIMESTAMP(3),
    "validated_by_name" TEXT,
    "decision" "WorkDecision",
    "decision_note" TEXT,
    "decided_by_user_id" UUID,
    "decided_by_name" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "work_tasks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "work_tasks_tenantId_fkey" FOREIGN KEY ("tenantId")
      REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "work_tasks_process_id_fkey" FOREIGN KEY ("process_id")
      REFERENCES "work_processes"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "work_tasks_tenantId_code_key" ON "work_tasks"("tenantId", "code");
CREATE INDEX "work_tasks_tenantId_idx" ON "work_tasks"("tenantId");
CREATE INDEX "work_tasks_tenantId_stage_idx" ON "work_tasks"("tenantId", "stage");
CREATE INDEX "work_tasks_process_id_idx" ON "work_tasks"("process_id");

-- 3) Skills prioritárias (atual × alvo, 0-100)
CREATE TABLE "work_skills" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "current" INTEGER NOT NULL,
    "target" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "work_skills_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "work_skills_tenantId_fkey" FOREIGN KEY ("tenantId")
      REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "work_skills_tenantId_name_key" ON "work_skills"("tenantId", "name");
CREATE INDEX "work_skills_tenantId_idx" ON "work_skills"("tenantId");

-- 4) Blueprints e pilotos (status resolve o KPI "pilotos em andamento")
CREATE TABLE "work_pilots" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "process_id" UUID,
    "kind" "WorkPilotKind" NOT NULL DEFAULT 'PILOTO',
    "name" TEXT NOT NULL,
    "baseline" TEXT NOT NULL,
    "indicator" TEXT NOT NULL,
    "result" TEXT NOT NULL DEFAULT '',
    "confidence" "WorkConfidence" NOT NULL,
    "status" "WorkPilotStatus" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "work_pilots_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "work_pilots_tenantId_fkey" FOREIGN KEY ("tenantId")
      REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "work_pilots_process_id_fkey" FOREIGN KEY ("process_id")
      REFERENCES "work_processes"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "work_pilots_tenantId_idx" ON "work_pilots"("tenantId");
CREATE INDEX "work_pilots_process_id_idx" ON "work_pilots"("process_id");

-- RLS: data plane isolado por tenant (mesmo padrão de ai_use_cases). O portal
-- escreve via forTenant (crivo_app); o Super Admin escreve/lê via forTenant
-- com o organizationId resolvido de Tenant.id (RLS ativa mesmo vindo de admin/).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['work_processes','work_tasks','work_skills','work_pilots'] LOOP
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

-- 5) Catálogo RBAC (dados) — IDEMPOTENTE, espelha PERMISSIONS/ROLE_PERMISSIONS
--    de @crivo/types: workforce:manage para RH, ADMIN, CEO e GESTOR (cadastro
--    de processos/tarefas/skills/pilotos e a decisão humana por tarefa). A
--    leitura é por papel (@Roles), não por permissão.
INSERT INTO "permissions" ("id", "code", "module", "action", "label") VALUES
  (gen_random_uuid(), 'workforce:manage', 'workforce', 'manage', 'Gerir Workforce Intelligence')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permId")
SELECT r."id", p."id"
FROM (VALUES
  ('ADMIN','workforce:manage'),
  ('CEO','workforce:manage'),
  ('GESTOR','workforce:manage'),
  ('RH','workforce:manage')
) AS m("role_code", "perm_code")
JOIN "role_defs" r ON r."code" = m."role_code"
JOIN "permissions" p ON p."code" = m."perm_code"
ON CONFLICT DO NOTHING;
