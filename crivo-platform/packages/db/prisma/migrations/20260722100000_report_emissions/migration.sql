-- Motor de Relatórios (R-001): emissões IMUTÁVEIS de documentos/dossiês.
CREATE TABLE "report_emissions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "emissionNumber" INTEGER NOT NULL,
    "method" TEXT,
    "technicalOutput" TEXT,
    "content" JSONB NOT NULL,
    "content_hash" TEXT NOT NULL,
    "generated_by" TEXT,
    "status" TEXT NOT NULL DEFAULT 'EMITIDA',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "report_emissions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "report_emissions_tenantId_fkey" FOREIGN KEY ("tenantId")
      REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "report_emissions_tenantId_type_emissionNumber_key"
  ON "report_emissions"("tenantId", "type", "emissionNumber");
CREATE INDEX "report_emissions_tenantId_idx" ON "report_emissions"("tenantId");
CREATE INDEX "report_emissions_type_idx" ON "report_emissions"("type");

-- RLS: tabela do data plane, isolada por tenant (mesmo padrão de diagnostic_*).
ALTER TABLE "report_emissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "report_emissions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "report_emissions"
  USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant());
GRANT SELECT, INSERT, UPDATE, DELETE ON "report_emissions" TO crivo_app;
