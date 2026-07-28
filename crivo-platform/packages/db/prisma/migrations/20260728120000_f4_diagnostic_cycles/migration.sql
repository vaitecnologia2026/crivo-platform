-- F4 Pacote de Templates — CICLOS FORMAIS de diagnóstico (decisão do cliente:
-- "ciclo = aplicação formal aberta e encerrada"). O encerramento congela o
-- snapshot que alimenta o TPL-003 (Relatório de Evolução e Efetividade).
CREATE TABLE "diagnostic_cycles" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABERTO',
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "opened_by" TEXT,
    "closed_at" TIMESTAMP(3),
    "closed_by" TEXT,
    "method" TEXT,
    "methodology_version" TEXT,
    "snapshot" JSONB,

    CONSTRAINT "diagnostic_cycles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "diagnostic_cycles_tenantId_idx" ON "diagnostic_cycles"("tenantId");

-- Empresa excluída não deixa ciclos órfãos (mesmo padrão da F2).
ALTER TABLE "diagnostic_cycles" ADD CONSTRAINT "diagnostic_cycles_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invariante "1 ciclo ABERTO por tenant" garantido NO BANCO (dois POSTs
-- simultâneos não criam dois abertos — o segundo recebe unique violation).
CREATE UNIQUE INDEX "diagnostic_cycles_one_open" ON "diagnostic_cycles"("tenantId")
  WHERE status = 'ABERTO';

-- RLS data-plane (mesmo padrão de devolutiva_records/action_item_history):
-- FORCE + policy por tenant + GRANT para o papel da aplicação, NA PRÓPRIA migração.
ALTER TABLE "diagnostic_cycles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "diagnostic_cycles" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "diagnostic_cycles"
  USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant());
GRANT SELECT, INSERT, UPDATE, DELETE ON "diagnostic_cycles" TO crivo_app;
