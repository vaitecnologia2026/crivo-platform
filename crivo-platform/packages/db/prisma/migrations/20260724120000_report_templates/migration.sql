-- Motor 4 — modelos de relatório vinculados ao Motor de Diagnósticos.
-- Control-plane (catálogo global), owner-only como products/ai_call_logs.
CREATE TABLE "report_templates" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "instrument_slug" TEXT NOT NULL,
    "sections" JSONB NOT NULL DEFAULT '[]',
    "include_results" BOOLEAN NOT NULL DEFAULT true,
    "include_dimensions" BOOLEAN NOT NULL DEFAULT true,
    "include_plan" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "report_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "report_templates_key_key" ON "report_templates"("key");
CREATE INDEX "report_templates_instrument_slug_idx" ON "report_templates"("instrument_slug");

ALTER TABLE "report_templates" ADD CONSTRAINT "report_templates_instrument_slug_fkey"
  FOREIGN KEY ("instrument_slug") REFERENCES "diagnostic_instruments"("slug")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Owner-only (o portal lê via serviço com conexão owner, nunca direto do data plane).
ALTER TABLE "report_templates" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "report_templates" FROM crivo_app;
