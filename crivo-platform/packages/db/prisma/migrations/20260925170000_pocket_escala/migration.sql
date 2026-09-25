-- POCKET: resposta em ESCALA (1–5), não dissertativa.
--
-- ADITIVA e NULLABLE: nenhuma linha existente muda. As reflexões da v1
-- (resposta aberta) ficam com value NULL e o texto como estava.
--
-- Por que existe: decisão do cliente (25/09/2026) — "no caso do pocket, as
-- respostas têm escala e não são dissertativas". Escala de concordância 1–5,
-- a mesma do ICD; o texto vira comentário opcional.
ALTER TABLE "pocket_reflections" ADD COLUMN "value" INTEGER;
