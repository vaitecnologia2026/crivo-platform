-- Motor de IA — telemetria de chamadas (control plane, owner-only como audit_log:
-- sem GRANT para crivo_app; todo acesso via conexão owner do PrismaService).
CREATE TABLE "ai_call_logs" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "useCase" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "error_reason" TEXT,
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "total_tokens" INTEGER,
    "latency_ms" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_call_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_call_logs_createdAt_idx" ON "ai_call_logs"("createdAt");
CREATE INDEX "ai_call_logs_tenantId_idx" ON "ai_call_logs"("tenantId");
CREATE INDEX "ai_call_logs_useCase_idx" ON "ai_call_logs"("useCase");

-- Owner-only imposto AQUI (não só no rls.sql): o ALTER DEFAULT PRIVILEGES do
-- rls.sql concede DML a crivo_app em toda tabela nova, então sem este bloco a
-- telemetria ficaria legível/alterável pela conexão do data plane. Mesmo padrão
-- do audit_log (ver ctrl_tables em prisma/sql/rls.sql).
ALTER TABLE "ai_call_logs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "ai_call_logs" FROM crivo_app;
