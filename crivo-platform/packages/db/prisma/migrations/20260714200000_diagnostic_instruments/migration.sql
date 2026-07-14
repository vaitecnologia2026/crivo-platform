-- Motor dinâmico (call 14/07, fase expand): catálogo de instrumentos +
-- methodology_versions.instrument enum → TEXT com FK. Os slugs dos built-in
-- são os valores históricos do enum → nenhum dado é reescrito.
-- O TYPE "MethodologyInstrument" NÃO é dropado aqui (janela de deploy segura).

CREATE TYPE "ScoreAggregation" AS ENUM ('MEDIA_PONDERADA', 'MEDIA_SIMPLES', 'SOMA_NORMALIZADA');

CREATE TABLE "diagnostic_instruments" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "band_kind" "MethodologyBandKind" NOT NULL DEFAULT 'MATURITY',
    "aggregation" "ScoreAggregation" NOT NULL DEFAULT 'MEDIA_PONDERADA',
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "built_in" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "diagnostic_instruments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "diagnostic_instruments_slug_key" ON "diagnostic_instruments"("slug");

-- Seed dos built-in DENTRO da migração (prod não roda seed.ts) — UUIDs literais.
INSERT INTO "diagnostic_instruments"
  ("id", "slug", "name", "band_kind", "aggregation", "description", "active", "built_in", "updated_at")
VALUES
  ('3d100000-0000-4000-8000-000000000001', 'PRE_DIAGNOSTIC', 'Diagnóstico Inicial (LP)', 'MATURITY', 'MEDIA_PONDERADA',
   'Instrumento de entrada do funil (LP): autoavaliação de maturidade em 5 dimensões.', true, true, CURRENT_TIMESTAMP),
  ('3d100000-0000-4000-8000-000000000002', 'PSYCHOSOCIAL', 'Diagnóstico Organizacional', 'RISK', 'MEDIA_PONDERADA',
   'Diagnóstico psicossocial organizacional (NR-1): anônimo por colaborador, agregado por setor.', true, true, CURRENT_TIMESTAMP);

-- enum → TEXT preservando valores (tabela minúscula; índices dependentes são rebuildados).
ALTER TABLE "methodology_versions" ALTER COLUMN "instrument" TYPE TEXT USING "instrument"::text;

ALTER TABLE "methodology_versions" ADD CONSTRAINT "methodology_versions_instrument_fkey"
  FOREIGN KEY ("instrument") REFERENCES "diagnostic_instruments"("slug")
  ON DELETE RESTRICT ON UPDATE CASCADE;
