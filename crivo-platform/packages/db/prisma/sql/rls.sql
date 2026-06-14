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
                         'assessment_cycles','assessments','responses','icd_scores','leads',
                         'tenant_modules','usage_counters','tenant_branding','library_items',
                         'action_plans','action_items','evidences'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Colunas em camelCase (Prisma não snake_case sem @map) → %I as cita.
    tenant_col := CASE WHEN t = 'organizations' THEN 'id' ELSE 'tenantId' END;

    -- ENABLE + FORCE: FORCE aplica as policies MESMO ao owner da tabela (crivo).
    -- Sem FORCE, se o runtime conectasse como owner por engano (ex.:
    -- DATABASE_URL_APP ausente), a RLS seria silenciosamente ignorada e haveria
    -- vazamento cross-tenant. Para operações administrativas legítimas
    -- (migrate/seed/provisioning) use um papel com BYPASSRLS ou sete app.tenant.
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
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

-- 4) CONTROL PLANE (F1): super_admins e tenants são GLOBAIS (sem RLS por
--    tenant). Habilitamos RLS SEM policy e SEM FORCE: o owner (conexão admin,
--    BYPASSRLS) acessa normalmente, mas crivo_app (não-owner, sujeito à RLS)
--    fica BLOQUEADO por não haver policy. O REVOKE é defesa adicional.
--    Resultado: apenas o módulo Admin (prisma.admin/owner) toca essas tabelas.
DO $$
DECLARE
  c text;
  -- tenant_domains (F5): resolução por domínio é pré-login (sem tenant no
  -- contexto) → acesso só via owner, como o restante do control plane.
  -- products + platform_leads: catálogo de produtos e CRM do super admin são
  -- globais (funil comercial da CRIVO) → owner-only, como o resto do control plane.
  ctrl_tables text[] := ARRAY['super_admins','tenants','audit_log','tenant_domains','products','platform_leads','contracts','ai_settings'];
BEGIN
  FOREACH c IN ARRAY ctrl_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', c);
    EXECUTE format('REVOKE ALL ON %I FROM crivo_app;', c);
  END LOOP;
END
$$;

-- 5) CATÁLOGOS GLOBAIS somente-leitura para o app:
--    RBAC (F3): permissions / role_defs / role_permissions
--    Módulos (F4): module_catalog
--    São compartilhados entre todas as empresas (sem RLS por tenant), mas a
--    escrita acontece só via seed/owner.
DO $$
DECLARE
  c text;
  catalog_tables text[] := ARRAY['permissions','role_defs','role_permissions','module_catalog'];
BEGIN
  FOREACH c IN ARRAY catalog_tables LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON %I FROM crivo_app;', c);
  END LOOP;
END
$$;

-- 6) Módulos por empresa (F4): tenant_modules tem RLS por tenant (item 3, p/ a
--    plataforma LER só os módulos da própria empresa via forTenant), mas a
--    ESCRITA é owner-only — quem (des)ativa módulo é o super admin (control
--    plane, conexão owner). Assim uma empresa não se auto-habilita um módulo
--    que não contratou, mesmo que um bug exponha um caminho de escrita.
REVOKE INSERT, UPDATE, DELETE ON tenant_modules FROM crivo_app;

-- 7) White-label (F5): tenant_branding tem RLS por tenant (item 3). A escrita é
--    permitida ao app — a RLS (WITH CHECK) confina ao próprio tenant e a API
--    gateia por permissão `branding:edit` (self-service do admin da empresa).
--    O super admin (owner) também escreve via control plane. Sem REVOKE aqui.

-- =====================================================================
-- ⚠️  REQUISITO DE DEPLOY (por causa do FORCE ROW LEVEL SECURITY acima):
--     A conexão de LOGIN/admin (DATABASE_URL, usada em auth.service para
--     buscar o usuário por e-mail ANTES de conhecer o tenant) precisa de um
--     papel que IGNORE a RLS — caso contrário current_tenant() é NULL e o
--     login não encontra ninguém. Garanta UMA das opções:
--       • o papel da DATABASE_URL é superuser (padrão do Postgres local), ou
--       • conceda BYPASSRLS explicitamente:   ALTER ROLE <owner> BYPASSRLS;
--     O papel crivo_app (DATABASE_URL_APP) NÃO deve ter BYPASSRLS — é ele que
--     fica sujeito às policies nas queries de negócio.
-- =====================================================================

-- Nota: audit_log (fase F2) recebe policy somente-INSERT (append-only).
