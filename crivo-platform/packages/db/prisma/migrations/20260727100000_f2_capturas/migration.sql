-- F2 (Pacote de Templates) — capturas que alimentam os documentos oficiais.

-- Cabeçalho do Dossiê: dados da organização (self-service "Minha Organização").
ALTER TABLE "organizations" ADD COLUMN "establishment" TEXT;
ALTER TABLE "organizations" ADD COLUMN "employees_count" TEXT;
ALTER TABLE "organizations" ADD COLUMN "work_model" TEXT;

-- Matriz/plano oficiais: área/processo, medida existente e indicador por ação.
ALTER TABLE "action_items" ADD COLUMN "area_process" TEXT;
ALTER TABLE "action_items" ADD COLUMN "existing_measure" TEXT;
ALTER TABLE "action_items" ADD COLUMN "indicator" TEXT;

-- Trilha de alteração por ação (TPL-004 §2).
CREATE TABLE "action_item_history" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "action_item_id" UUID NOT NULL,
    "change" TEXT NOT NULL,
    "changed_by" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "action_item_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "action_item_history_tenantId_idx" ON "action_item_history"("tenantId");
CREATE INDEX "action_item_history_action_item_id_idx" ON "action_item_history"("action_item_id");
ALTER TABLE "action_item_history" ADD CONSTRAINT "action_item_history_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "action_item_history" ADD CONSTRAINT "action_item_history_action_item_id_fkey"
  FOREIGN KEY ("action_item_id") REFERENCES "action_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Registro de comunicação e devolutiva (TPL-002 §10).
CREATE TABLE "devolutiva_records" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "format" TEXT NOT NULL,
    "audience" TEXT,
    "topics" TEXT,
    "confirmed_points" TEXT,
    "communicated_measures" TEXT,
    "created_by" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "devolutiva_records_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "devolutiva_records_tenantId_idx" ON "devolutiva_records"("tenantId");
ALTER TABLE "devolutiva_records" ADD CONSTRAINT "devolutiva_records_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS data-plane (mesmo padrão de diagnostic_links/report_emissions):
-- FORCE + policy por tenant + GRANT para o papel da aplicação, NA PRÓPRIA migração.
ALTER TABLE "action_item_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "action_item_history" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "action_item_history"
  USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant());
GRANT SELECT, INSERT, UPDATE, DELETE ON "action_item_history" TO crivo_app;

ALTER TABLE "devolutiva_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "devolutiva_records" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "devolutiva_records"
  USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant());
GRANT SELECT, INSERT, UPDATE, DELETE ON "devolutiva_records" TO crivo_app;
