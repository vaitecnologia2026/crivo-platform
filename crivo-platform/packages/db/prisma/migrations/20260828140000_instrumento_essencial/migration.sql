-- Qual diagnóstico cada MÉTODO aplica passa a ser DADO, não código.
--
-- Antes, o método ESSENCIAL estava preso ao instrumento PRE_DIAGNOSTIC — que é o
-- MESMO do quiz MAPA do site. Mudar as perguntas do Essencial mudaria a captação
-- de leads junto. Agora o Essencial tem instrumento próprio.
--
-- Migration à MÃO (padrão do repo). Usar `prisma migrate deploy`.

-- 1) O vínculo método→instrumento vira coluna.
ALTER TABLE "diagnostic_instruments" ADD COLUMN "method" TEXT;

-- 2) Backfill dos built-in: o Executivo segue sendo o MAPA da LP (INICIAL);
--    o psicossocial segue no ORGANIZACIONAL.
UPDATE "diagnostic_instruments" SET "method" = 'INICIAL'       WHERE "slug" = 'PRE_DIAGNOSTIC';
UPDATE "diagnostic_instruments" SET "method" = 'ORGANIZACIONAL' WHERE "slug" = 'PSYCHOSOCIAL';

-- 3) Instrumento próprio do Essencial (régua de RISCO, como o Organizacional).
INSERT INTO "diagnostic_instruments" ("id","slug","name","band_kind","aggregation","description","active","built_in","method","created_at","updated_at")
SELECT gen_random_uuid(), 'essencial', 'Diagnóstico Essencial', 'RISK', 'MEDIA_PONDERADA',
       'Diagnóstico aplicado a quem contratou o CRIVO Diagnóstico Essencial. Nasceu como cópia do Diagnóstico Organizacional e é configurável no Motor.',
       true, true, 'ESSENCIAL', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "diagnostic_instruments" WHERE "slug" = 'essencial');

-- 4) Copia a versão ATIVA do Organizacional como versão 1 ACTIVE do Essencial.
--    Se não houver versão ativa, o instrumento fica sem versão e o admin publica
--    depois — nada quebra (o resolvedor cai no fallback).
DO $$
DECLARE
  src_id UUID;
  new_id UUID;
BEGIN
  SELECT "id" INTO src_id FROM "methodology_versions"
   WHERE "instrument" = 'PSYCHOSOCIAL' AND "status" = 'ACTIVE' LIMIT 1;
  IF src_id IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM "methodology_versions" WHERE "instrument" = 'essencial') THEN RETURN; END IF;

  new_id := gen_random_uuid();
  INSERT INTO "methodology_versions"
    ("id","instrument","version","label","status","notes","created_by","created_at","published_at","scale_labels","rounding","min_valid_completion_percent")
  SELECT new_id, 'essencial', 1, 'v1 — cópia do Diagnóstico Organizacional', 'ACTIVE',
         'Criada automaticamente ao separar o Essencial do quiz do site. Edite no Motor de Diagnósticos.',
         'sistema', NOW(), NOW(), "scale_labels", "rounding", "min_valid_completion_percent"
    FROM "methodology_versions" WHERE "id" = src_id;

  INSERT INTO "methodology_dimensions" ("id","version_id","slug","label","weight","order","parent_slug","aggregation","severity")
  SELECT gen_random_uuid(), new_id, "slug","label","weight","order","parent_slug","aggregation","severity"
    FROM "methodology_dimensions" WHERE "version_id" = src_id;

  INSERT INTO "methodology_questions" ("id","version_id","dimension_slug","factor_slugs","text","weight","inverse","required","scored","show_when_question_id","show_when_operator","show_when_value","order")
  SELECT gen_random_uuid(), new_id, "dimension_slug","factor_slugs","text","weight","inverse","required","scored","show_when_question_id","show_when_operator","show_when_value","order"
    FROM "methodology_questions" WHERE "version_id" = src_id;

  INSERT INTO "methodology_bands" ("id","version_id","kind","code","label","min","max","color","order")
  SELECT gen_random_uuid(), new_id, "kind","code","label","min","max","color","order"
    FROM "methodology_bands" WHERE "version_id" = src_id;

  INSERT INTO "methodology_factors" ("id","version_id","slug","label","severity","consequences","dimension_slug","order")
  SELECT gen_random_uuid(), new_id, "slug","label","severity","consequences","dimension_slug","order"
    FROM "methodology_factors" WHERE "version_id" = src_id;
END $$;
