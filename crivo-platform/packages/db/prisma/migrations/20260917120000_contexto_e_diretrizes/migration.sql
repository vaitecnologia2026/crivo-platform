-- Contexto e Diretrizes (módulo 'contexto' — Programas › Contexto e Diretrizes).
--
-- Workspace da IA Contextualizada do CLIENTE: base segregada por empresa com
-- diretrizes institucionais (ciclo Rascunho → Em revisão → Aprovada | Revogada),
-- documentos autorizados (código D-NNN sequencial por empresa; ciclo Rascunho →
-- Em revisão → Aprovado/Publicado → Substituído | Revogado; bytes em tabela
-- própria, padrão evidence_files; texto extraído pelo mesmo pipeline dos anexos
-- de prompt), terminologia/regras e o vínculo por caso de uso REAL da Central
-- de Prompts × documentos + toggle "uso contextual ativo".
--
-- Integração: AiSettingsService.buildTenantDirectives passa a anexar ao prompt
-- SÓ as diretrizes APROVADAS e o texto dos documentos APROVADO_PUBLICADO
-- vinculados ao caso de uso ativo — nunca rascunhos. Para rastrear quais
-- documentos entraram em cada chamada, ai_call_logs ganha a coluna `meta`.
--
-- Puramente ADITIVA: cinco tabelas novas que nascem vazias, uma coluna nullable
-- em ai_call_logs e a permissão context:manage (idempotente).
--
-- Migration escrita à MÃO (padrão do repo): `prisma migrate dev` quebra (P3006)
-- porque a shadow DB não tem current_tenant(). Usar `prisma migrate deploy`.

CREATE TYPE "TenantDirectiveStatus" AS ENUM ('RASCUNHO', 'EM_REVISAO', 'APROVADA', 'REVOGADA');
CREATE TYPE "TenantDocumentStatus" AS ENUM ('RASCUNHO', 'EM_REVISAO', 'APROVADO_PUBLICADO', 'SUBSTITUIDO', 'REVOGADO');

-- 1) Diretrizes institucionais
CREATE TABLE "tenant_directives" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" "TenantDirectiveStatus" NOT NULL DEFAULT 'RASCUNHO',
    "version" INTEGER NOT NULL DEFAULT 1,
    "approved_by_user_id" UUID,
    "approved_by_name" TEXT,
    "approved_at" TIMESTAMP(3),
    "revoke_justification" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenant_directives_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tenant_directives_tenantId_fkey" FOREIGN KEY ("tenantId")
      REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "tenant_directives_tenantId_idx" ON "tenant_directives"("tenantId");
CREATE INDEX "tenant_directives_tenantId_status_idx" ON "tenant_directives"("tenantId", "status");

-- 2) Documentos autorizados (metadados + texto extraído; bytes na tabela 3)
CREATE TABLE "tenant_documents" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "cnpj" TEXT,
    "unit_id" UUID,
    "version" TEXT NOT NULL DEFAULT 'v1.0',
    "issued_at" TIMESTAMP(3),
    "owner" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "modules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "access_level" TEXT NOT NULL,
    "status" "TenantDocumentStatus" NOT NULL DEFAULT 'RASCUNHO',
    "replaced_by_id" UUID,
    "revoke_justification" TEXT,
    "url" TEXT,
    "file_name" TEXT,
    "file_mime" TEXT,
    "file_size" INTEGER,
    "extracted_text" TEXT,
    "extracted_chars" INTEGER NOT NULL DEFAULT 0,
    "approved_by_user_id" UUID,
    "approved_by_name" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenant_documents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tenant_documents_tenantId_fkey" FOREIGN KEY ("tenantId")
      REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tenant_documents_unit_id_fkey" FOREIGN KEY ("unit_id")
      REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "tenant_documents_tenantId_code_key" ON "tenant_documents"("tenantId", "code");
CREATE INDEX "tenant_documents_tenantId_idx" ON "tenant_documents"("tenantId");
CREATE INDEX "tenant_documents_tenantId_status_idx" ON "tenant_documents"("tenantId", "status");

-- 3) Bytes do arquivo (1:1 com o documento; só lidos no download)
CREATE TABLE "tenant_document_files" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenant_document_files_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tenant_document_files_tenantId_fkey" FOREIGN KEY ("tenantId")
      REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tenant_document_files_document_id_fkey" FOREIGN KEY ("document_id")
      REFERENCES "tenant_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "tenant_document_files_document_id_key" ON "tenant_document_files"("document_id");
CREATE INDEX "tenant_document_files_tenantId_idx" ON "tenant_document_files"("tenantId");

-- 4) Terminologia e regras
CREATE TABLE "tenant_terms" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "term" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenant_terms_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tenant_terms_tenantId_fkey" FOREIGN KEY ("tenantId")
      REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "tenant_terms_tenantId_idx" ON "tenant_terms"("tenantId");

-- 5) Caso de uso da IA × documentos autorizados (+ toggle). Sem linha = desligado.
CREATE TABLE "tenant_ai_use_case_contexts" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "use_case" TEXT NOT NULL,
    "document_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    "active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenant_ai_use_case_contexts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tenant_ai_use_case_contexts_tenantId_fkey" FOREIGN KEY ("tenantId")
      REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "tenant_ai_use_case_contexts_tenantId_use_case_key"
  ON "tenant_ai_use_case_contexts"("tenantId", "use_case");
CREATE INDEX "tenant_ai_use_case_contexts_tenantId_idx" ON "tenant_ai_use_case_contexts"("tenantId");

-- RLS: data plane isolado por tenant (mesmo padrão de ai_use_cases). O portal
-- escreve via forTenant (crivo_app); buildTenantDirectives (admin/) lê via
-- owner com tenantId explícito.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tenant_directives','tenant_documents','tenant_document_files','tenant_terms','tenant_ai_use_case_contexts'] LOOP
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

-- 6) Rastreabilidade: quais documentos/diretrizes do cliente entraram em cada
--    chamada de IA (control plane, owner-only — sem mudança de RLS).
ALTER TABLE "ai_call_logs" ADD COLUMN "meta" JSONB;

-- 7) Catálogo RBAC (dados) — IDEMPOTENTE, espelha PERMISSIONS/ROLE_PERMISSIONS
--    de @crivo/types: context:manage para RH, ADMIN, CEO e GESTOR (escrita em
--    diretrizes, documentos, termos e casos de uso). A leitura é por papel.
INSERT INTO "permissions" ("id", "code", "module", "action", "label") VALUES
  (gen_random_uuid(), 'context:manage', 'contexto', 'manage', 'Gerir Contexto e Diretrizes')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permId")
SELECT r."id", p."id"
FROM (VALUES
  ('ADMIN','context:manage'),
  ('CEO','context:manage'),
  ('GESTOR','context:manage'),
  ('RH','context:manage')
) AS m("role_code", "perm_code")
JOIN "role_defs" r ON r."code" = m."role_code"
JOIN "permissions" p ON p."code" = m."perm_code"
ON CONFLICT DO NOTHING;
