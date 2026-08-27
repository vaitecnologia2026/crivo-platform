-- Fatores de risco da metodologia (Orientação NR-1 §8): a SEVERIDADE pertence ao
-- FATOR e às suas possíveis consequências, não à dimensão. `methodology_dimensions.severity`
-- continua existindo como FALLBACK para as versões já parametrizadas.
--
-- Mesma classe das demais methodology_*: catálogo global versionado (sem RLS por
-- tenant). Migration escrita à MÃO — `prisma migrate dev` quebra (P3006) porque a
-- shadow DB não tem current_tenant(). Usar `prisma migrate deploy`.
CREATE TABLE "methodology_factors" (
    "id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "severity" INTEGER NOT NULL,
    "consequences" TEXT,
    "dimension_slug" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "methodology_factors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "methodology_factors_version_id_slug_key" ON "methodology_factors"("version_id", "slug");
CREATE INDEX "methodology_factors_version_id_idx" ON "methodology_factors"("version_id");

ALTER TABLE "methodology_factors" ADD CONSTRAINT "methodology_factors_version_id_fkey"
  FOREIGN KEY ("version_id") REFERENCES "methodology_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
