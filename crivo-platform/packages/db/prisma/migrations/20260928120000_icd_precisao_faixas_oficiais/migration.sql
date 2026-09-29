-- ICD: precisão total e faixas oficiais do Anexo Liderança/IA v1.1 §6.3.
--
-- Decisão CRIVO (28/09/2026): o ICD guarda o valor com precisão total, a tela
-- exibe 1 casa decimal e a faixa é definida pelo valor bruto. Até aqui cada
-- etapa arredondava para inteiro (eixo 62,5 virava 63), e as colunas eram
-- INTEGER. As 6 faixas de "Maturidade Decisória" (anexo v1, arquivado) viram
-- as 4 oficiais: Crítica 0–49, Vulnerável 50–64, Consistente 65–79, Forte 80–100.
--
-- Nenhuma linha é apagada. Ciclos FECHADOS são o oficial congelado: seus
-- scores não são recalculados (só mudam com reabertura auditada — decisão 6).

-- 1) Colunas de score: INTEGER → DOUBLE PRECISION (valores atuais preservados).
ALTER TABLE "decision_icd_scores"   ALTER COLUMN "score" TYPE DOUBLE PRECISION USING "score"::double precision;
ALTER TABLE "leader_quarterly_icd"  ALTER COLUMN "score" TYPE DOUBLE PRECISION USING "score"::double precision;
ALTER TABLE "company_quarterly_icd" ALTER COLUMN "score" TYPE DOUBLE PRECISION USING "score"::double precision;

-- 2) Recalcula, a partir das 8 respostas guardadas, o ICD das decisões que
--    NÃO estão em ciclo fechado (ciclo aberto ou sem ciclo). Mesma fórmula de
--    computeDecisionIcd: score da resposta = (valor − 1) × 25; eixo = média
--    das 2 afirmações; ICD = média dos 4 eixos — agora sem arredondar.
WITH conv AS (
  SELECT d."id",
         AVG(CASE WHEN a->>'id' IN ('P1','P2') THEN ((a->>'value')::double precision - 1) * 25 END) AS clareza,
         AVG(CASE WHEN a->>'id' IN ('P3','P4') THEN ((a->>'value')::double precision - 1) * 25 END) AS criterio,
         AVG(CASE WHEN a->>'id' IN ('P5','P6') THEN ((a->>'value')::double precision - 1) * 25 END) AS alinhamento,
         AVG(CASE WHEN a->>'id' IN ('P7','P8') THEN ((a->>'value')::double precision - 1) * 25 END) AS sustentacao
    FROM "decision_icd_scores" d
    LEFT JOIN "icd_cycles" c ON c."id" = d."cycleId"
    CROSS JOIN LATERAL jsonb_array_elements(d."answers") a
   WHERE (c."id" IS NULL OR c."status" <> 'CLOSED')
     AND jsonb_typeof(d."answers") = 'array'
   GROUP BY d."id"
)
UPDATE "decision_icd_scores" d
   SET "axes" = jsonb_build_object(
         'CLAREZA', conv.clareza,
         'CRITERIO', conv.criterio,
         'ALINHAMENTO', conv.alinhamento,
         'SUSTENTACAO', conv.sustentacao),
       "score" = (conv.clareza + conv.criterio + conv.alinhamento + conv.sustentacao) / 4
  FROM conv
 WHERE d."id" = conv."id"
   AND conv.clareza IS NOT NULL AND conv.criterio IS NOT NULL
   AND conv.alinhamento IS NOT NULL AND conv.sustentacao IS NOT NULL;

-- 3) Distribuição por faixa guardada nos ciclos fechados: troca as 6 chaves
--    antigas pelas 4 oficiais, contando os ICDs de líder já congelados. Sob
--    supressão (§7) a distribuição continua zerada.
UPDATE "company_quarterly_icd" q
   SET "distribution" = jsonb_build_object(
         'CRITICA',     (SELECT COUNT(*) FROM "leader_quarterly_icd" l WHERE l."cycleId" = q."cycleId" AND NOT q."suppressed" AND l."score" < 50),
         'VULNERAVEL',  (SELECT COUNT(*) FROM "leader_quarterly_icd" l WHERE l."cycleId" = q."cycleId" AND NOT q."suppressed" AND l."score" >= 50 AND l."score" < 65),
         'CONSISTENTE', (SELECT COUNT(*) FROM "leader_quarterly_icd" l WHERE l."cycleId" = q."cycleId" AND NOT q."suppressed" AND l."score" >= 65 AND l."score" < 80),
         'FORTE',       (SELECT COUNT(*) FROM "leader_quarterly_icd" l WHERE l."cycleId" = q."cycleId" AND NOT q."suppressed" AND l."score" >= 80));
