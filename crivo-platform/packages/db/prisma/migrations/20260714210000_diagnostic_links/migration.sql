-- Aplicação de diagnósticos do catálogo (motor dinâmico): link público /d/<slug>
-- por tenant+instrumento e respostas anônimas (espelho do psicossocial).

CREATE TABLE "diagnostic_links" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "instrument_slug" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "diagnostic_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "diagnostic_links_slug_key" ON "diagnostic_links"("slug");
CREATE UNIQUE INDEX "diagnostic_links_tenantId_instrument_slug_key" ON "diagnostic_links"("tenantId", "instrument_slug");
CREATE INDEX "diagnostic_links_tenantId_idx" ON "diagnostic_links"("tenantId");
ALTER TABLE "diagnostic_links" ADD CONSTRAINT "diagnostic_links_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "diagnostic_links" ADD CONSTRAINT "diagnostic_links_instrument_slug_fkey"
  FOREIGN KEY ("instrument_slug") REFERENCES "diagnostic_instruments"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "diagnostic_responses" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "instrument_slug" TEXT NOT NULL,
    "sector" TEXT,
    "answers" JSONB NOT NULL,
    "score" INTEGER NOT NULL,
    "level" TEXT NOT NULL,
    "byDimension" JSONB NOT NULL,
    "methodologyVersionId" UUID,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "diagnostic_responses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "diagnostic_responses_tenantId_idx" ON "diagnostic_responses"("tenantId");
CREATE INDEX "diagnostic_responses_instrument_slug_idx" ON "diagnostic_responses"("instrument_slug");
CREATE INDEX "diagnostic_responses_methodologyVersionId_idx" ON "diagnostic_responses"("methodologyVersionId");
ALTER TABLE "diagnostic_responses" ADD CONSTRAINT "diagnostic_responses_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "diagnostic_responses" ADD CONSTRAINT "diagnostic_responses_instrument_slug_fkey"
  FOREIGN KEY ("instrument_slug") REFERENCES "diagnostic_instruments"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS por tenant (mesmo desenho das demais tabelas de dados do cliente).
ALTER TABLE "diagnostic_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "diagnostic_links" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "diagnostic_links"
  USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant());
ALTER TABLE "diagnostic_responses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "diagnostic_responses" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "diagnostic_responses"
  USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant());
