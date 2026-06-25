-- People Analytics (Fase 4) — indicadores de RH por empresa, protegido por RLS.

-- CreateTable
CREATE TABLE "people_analytics_data" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "periods" JSONB NOT NULL,
    "analysis" JSONB,
    "analysisAt" TIMESTAMP(3),
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "people_analytics_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "people_analytics_data_tenantId_key" ON "people_analytics_data"("tenantId");

-- AddForeignKey
ALTER TABLE "people_analytics_data" ADD CONSTRAINT "people_analytics_data_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS (isolamento por tenant; mesma política do rls.sql, inline para o Railway)
ALTER TABLE "people_analytics_data" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "people_analytics_data" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "people_analytics_data";
CREATE POLICY tenant_isolation ON "people_analytics_data"
  USING ("tenantId" = current_tenant())
  WITH CHECK ("tenantId" = current_tenant());
