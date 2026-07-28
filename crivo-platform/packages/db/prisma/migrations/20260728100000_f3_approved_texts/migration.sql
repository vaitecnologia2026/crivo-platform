-- F3 Pacote de Templates — TEXTOS APROVADOS dos documentos (decisão 1-A):
-- IA gera rascunho → equipe CRIVO edita e aprova no Super Admin → o texto
-- aprovado (congelado) entra nos documentos. 1 linha por (tenant, doc, campo).
CREATE TABLE "approved_texts" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "doc_type" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "draft" TEXT,
    "draft_model" TEXT,
    "draft_at" TIMESTAMP(3),
    "approved_content" TEXT,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approved_texts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "approved_texts_tenantId_doc_type_field_key" ON "approved_texts"("tenantId", "doc_type", "field");
CREATE INDEX "approved_texts_tenantId_idx" ON "approved_texts"("tenantId");

-- Owner-only imposto AQUI (não só no rls.sql): o ALTER DEFAULT PRIVILEGES do
-- rls.sql concede DML a crivo_app em toda tabela nova. A fila de aprovação é
-- control plane (cross-tenant, super admin); o data plane só a lê via owner
-- (prisma.admin) dentro do gerador de documentos. Mesmo padrão do ai_call_logs.
ALTER TABLE "approved_texts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "approved_texts" FROM crivo_app;
