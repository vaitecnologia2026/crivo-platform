-- Configuração do Motor (singleton): regras globais de como o motor funciona
-- (feedback do cliente 15/07: a tela define o motor, não redireciona a ele).
CREATE TABLE "engine_config" (
    "id" UUID NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'global',
    "min_respondents" INTEGER NOT NULL DEFAULT 5,
    "default_aggregation" "ScoreAggregation" NOT NULL DEFAULT 'MEDIA_PONDERADA',
    "default_band_kind" "MethodologyBandKind" NOT NULL DEFAULT 'MATURITY',
    "default_scale_labels" TEXT[] NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "engine_config_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "engine_config_scope_key" ON "engine_config"("scope");

-- Linha default (singleton) — UUID literal.
INSERT INTO "engine_config" ("id", "scope", "updated_at")
VALUES ('e0100000-0000-4000-8000-000000000001', 'global', CURRENT_TIMESTAMP);
