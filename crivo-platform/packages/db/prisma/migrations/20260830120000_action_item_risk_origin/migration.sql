-- Ação do Plano de Evolução passa a poder registrar o CÁLCULO que a originou:
-- quando ela vem da matriz 5x5 (Risco = Probabilidade x Severidade), guarda o
-- fator e o retrato de P e S do momento da geração. Colunas aditivas e nullable:
-- ação criada à mão continua exatamente como antes.
--
-- NÃO se confunde com action_items.severity/probability (texto Baixa/Moderada/
-- Alta), que são a matriz 3x3 preenchida pela empresa. As duas réguas convivem
-- de propósito e nenhuma deriva da outra.
ALTER TABLE "action_items" ADD COLUMN IF NOT EXISTS "risk_factor_slug" TEXT;
ALTER TABLE "action_items" ADD COLUMN IF NOT EXISTS "risk_probability" INTEGER;
ALTER TABLE "action_items" ADD COLUMN IF NOT EXISTS "risk_severity" INTEGER;
ALTER TABLE "action_items" ADD COLUMN IF NOT EXISTS "suggestion_key" TEXT;

-- Idempotência: aceitar a mesma sugestão duas vezes não duplica a ação no plano.
-- NULL não colide em UNIQUE no Postgres, então itens criados à mão (sem chave)
-- não são afetados.
CREATE UNIQUE INDEX IF NOT EXISTS "action_items_plan_id_suggestion_key_key"
  ON "action_items" ("plan_id", "suggestion_key");
