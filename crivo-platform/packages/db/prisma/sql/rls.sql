-- =====================================================================
-- CRIVO™ Platform — Row-Level Security (isolamento multi-tenant)
-- Rode DEPOIS de `prisma migrate`:  pnpm db:rls
--
-- Modelo: a aplicação conecta como `crivo_app` (NÃO owner / NÃO superuser),
-- e a cada request seta:  SET app.tenant = '<organization_id>';
-- As policies abaixo garantem que cada conexão só enxerga seu próprio tenant.
-- =====================================================================

-- 1) Usuário de aplicação (sujeito às policies). Owner das tabelas (crivo) faz BYPASSRLS.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crivo_app') THEN
    CREATE ROLE crivo_app LOGIN PASSWORD 'crivo_app';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO crivo_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO crivo_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO crivo_app;

-- 2) Helper: lê o tenant do contexto da conexão (vazio => bloqueia tudo).
CREATE OR REPLACE FUNCTION current_tenant() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.tenant', true), '')::uuid;
$$ LANGUAGE sql STABLE;

-- 3) Ativa RLS + policy por tabela de negócio.
--    organizations usa o próprio id como tenant; as demais usam tenant_id.
DO $$
DECLARE
  t text;
  tenant_col text;
  tables text[] := ARRAY['organizations','companies','units','teams','users','team_members',
                         'assessment_cycles','assessments','responses','icd_scores'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Colunas em camelCase (Prisma não snake_case sem @map) → %I as cita.
    tenant_col := CASE WHEN t = 'organizations' THEN 'id' ELSE 'tenantId' END;

    -- ENABLE (sem FORCE): o owner (crivo) faz bypass — usado por migrate/seed/
    -- provisioning de tenant. O runtime conecta como crivo_app (não-owner) e
    -- por isso é submetido às policies abaixo.
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (%I = current_tenant())
         WITH CHECK (%I = current_tenant());',
      t, tenant_col, tenant_col
    );
  END LOOP;
END
$$;

-- Nota: audit_log (fase F2) recebe policy somente-INSERT (append-only).
