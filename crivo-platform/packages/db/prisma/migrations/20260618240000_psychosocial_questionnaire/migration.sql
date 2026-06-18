-- Questionário Psicossocial Organizacional (Briefing §6 — diagnóstico AMPLO por
-- colaborador). ANÔNIMO por design (§11/§14): sem vínculo com User. Data plane —
-- RLS por tenant inline (espelha rls.sql) para a migração ser self-contained em
-- produção. Confidencialidade efetiva vem da agregação (supressão < 5).

CREATE TABLE "psychosocial_responses" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "sector" TEXT,
    "answers" JSONB NOT NULL,
    "score" INTEGER NOT NULL,
    "level" TEXT NOT NULL,
    "byDimension" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "psychosocial_responses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "psychosocial_responses_tenantId_idx" ON "psychosocial_responses"("tenantId");
CREATE INDEX "psychosocial_responses_sector_idx" ON "psychosocial_responses"("sector");

ALTER TABLE "psychosocial_responses" ADD CONSTRAINT "psychosocial_responses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS por tenant (mesma policy de rls.sql). Owner com BYPASSRLS para migrate/seed.
ALTER TABLE "psychosocial_responses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "psychosocial_responses" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "psychosocial_responses";
CREATE POLICY tenant_isolation ON "psychosocial_responses"
  USING ("tenantId" = current_tenant())
  WITH CHECK ("tenantId" = current_tenant());
