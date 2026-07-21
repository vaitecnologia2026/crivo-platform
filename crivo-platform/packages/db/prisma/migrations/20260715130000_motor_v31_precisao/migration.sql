-- Motor v3.1 (pacote dos Seis Motores): precisão decimal, item de contexto,
-- item condicional e gate de cobertura. Migração ADITIVA — os instrumentos
-- existentes ficam com rounding NULL (= inteiro, comportamento atual).
ALTER TABLE "methodology_versions" ADD COLUMN "rounding" INTEGER;
ALTER TABLE "methodology_versions" ADD COLUMN "min_valid_completion_percent" INTEGER;

ALTER TABLE "methodology_questions" ADD COLUMN "scored" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "methodology_questions" ADD COLUMN "show_when_question_id" INTEGER;
ALTER TABLE "methodology_questions" ADD COLUMN "show_when_operator" TEXT;
ALTER TABLE "methodology_questions" ADD COLUMN "show_when_value" INTEGER;

-- Score passa a comportar 1 casa decimal (62,4 / 47,3). Widening seguro.
ALTER TABLE "diagnostic_responses" ALTER COLUMN "score" TYPE DOUBLE PRECISION;

-- Padrões do motor v3.1 na Configuração do Motor (todo diagnóstico NOVO nasce
-- com 1 casa decimal e cobertura mínima de 70%).
ALTER TABLE "engine_config" ADD COLUMN "default_rounding" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "engine_config" ADD COLUMN "default_min_valid_completion_percent" INTEGER NOT NULL DEFAULT 70;
