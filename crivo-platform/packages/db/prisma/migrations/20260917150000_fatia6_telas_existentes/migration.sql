-- Fatia 6 dos Programas: ajustes das 4 telas que já existiam (People
-- Analytics, Radar de Custos Invisíveis, Academia e Recursos, Mentorias) ao
-- layout do protótipo. Puramente ADITIVA:
--   1) library_items / global_academy_content ganham carga (minutos) e nível;
--   2) people_analytics_data ganha `catalog` (metadados de governança por
--      indicador + indicadores customizados — só metadados, nada de cálculo);
--   3) tabela nova invisible_cost_snapshots ("Congelar como ciclo" do Radar —
--      InvisibleCostEstimate é 1 por tenant e não guardava histórico).
-- Mentorias não precisa de migração (KPIs calculados no cliente).
--
-- Migration escrita à MÃO (padrão do repo): `prisma migrate dev` quebra (P3006)
-- porque a shadow DB não tem current_tenant(). Usar `prisma migrate deploy`.

-- 1) Academia: carga + nível (opcionais)
ALTER TABLE "library_items" ADD COLUMN "duration_min" INTEGER;
ALTER TABLE "library_items" ADD COLUMN "level" TEXT;
ALTER TABLE "global_academy_content" ADD COLUMN "duration_min" INTEGER;
ALTER TABLE "global_academy_content" ADD COLUMN "level" TEXT;

-- 2) People Analytics: catálogo de indicadores (JSON, nullable)
ALTER TABLE "people_analytics_data" ADD COLUMN "catalog" JSONB;

-- 3) Radar de Custos Invisíveis: histórico congelado por ciclo
CREATE TABLE "invisible_cost_snapshots" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "scenarios" JSONB NOT NULL,
    "confidence" TEXT NOT NULL DEFAULT 'MEDIA',
    "totals" JSONB NOT NULL,
    "created_by_user_id" UUID,
    "created_by_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invisible_cost_snapshots_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "invisible_cost_snapshots_tenantId_fkey" FOREIGN KEY ("tenantId")
      REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "invisible_cost_snapshots_tenantId_idx" ON "invisible_cost_snapshots"("tenantId");

-- RLS: data plane isolado por tenant (mesmo padrão de invisible_cost_estimates).
-- O portal grava via forTenant (crivo_app).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['invisible_cost_snapshots'] LOOP
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
