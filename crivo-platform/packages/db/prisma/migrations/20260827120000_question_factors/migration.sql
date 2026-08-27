-- Cadeia NR-1 §9: "a pergunta alimenta um ou mais fatores da metodologia".
-- A pergunta continua pertencendo à DIMENSÃO (que gera o score 0-100); o vínculo
-- com fatores é a leitura de RISCO (probabilidade da Matriz).
--
-- Ambas aditivas e com default: nada a fazer com os dados existentes.
-- Migration à MÃO (padrão do repo) — `migrate dev` quebra (P3006, shadow DB sem
-- current_tenant()). Usar `prisma migrate deploy`.
ALTER TABLE "methodology_questions" ADD COLUMN "factor_slugs" TEXT[] NOT NULL DEFAULT '{}';

-- Média 0-100 por fator, gravada junto do byDimension no submit. NULL = resposta
-- anterior aos fatores (é ignorada no cálculo do fator, e não contada como zero).
ALTER TABLE "psychosocial_responses" ADD COLUMN "by_factor" JSONB;
