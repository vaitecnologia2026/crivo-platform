-- Custos Invisíveis (Fase 2) — estimativa por empresa, protegida por RLS.

-- CreateTable
CREATE TABLE "invisible_cost_estimates" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "items" JSONB NOT NULL,
    "scenarios" JSONB NOT NULL,
    "confidence" TEXT NOT NULL DEFAULT 'MEDIA',
    "notes" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "invisible_cost_estimates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invisible_cost_estimates_tenantId_key" ON "invisible_cost_estimates"("tenantId");

-- AddForeignKey
ALTER TABLE "invisible_cost_estimates" ADD CONSTRAINT "invisible_cost_estimates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS (isolamento por tenant; mesma política do rls.sql, aplicada inline para o Railway)
ALTER TABLE "invisible_cost_estimates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invisible_cost_estimates" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "invisible_cost_estimates";
CREATE POLICY tenant_isolation ON "invisible_cost_estimates"
  USING ("tenantId" = current_tenant())
  WITH CHECK ("tenantId" = current_tenant());
