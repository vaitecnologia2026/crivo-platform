-- Vinculo da acao com o ciclo de diagnostico que a originou + status
-- NAO_ADOTADA (sugestao avaliada e recusada). Ambos ADITIVOS: coluna
-- nullable e novo valor de enum. Nenhuma linha existente muda.
ALTER TABLE "action_items" ADD COLUMN "cycle_id" UUID;
-- IF NOT EXISTS mantem a migration idempotente; o valor novo nao e USADO
-- nesta mesma transacao, que e a restricao do Postgres para ADD VALUE.
ALTER TYPE "ActionStatus" ADD VALUE IF NOT EXISTS 'NAO_ADOTADA';
