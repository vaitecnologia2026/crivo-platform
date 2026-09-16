-- Score da resposta psicossocial (Organizacional) com casa decimal.
--
-- Ajustes Finais de Homologação: "manter 1 casa decimal em todos os scores
-- exibidos". O motor já pontua com as casas da metodologia (`rounding`), mas a
-- coluna era INTEGER — com rounding = 1 a gravação de 55.4 falhava na
-- validação do Prisma e a campanha do Organizacional não aceitava resposta.
--
-- Alargamento puro: valores inteiros existentes ficam iguais; nenhum código
-- depende do tipo (o cliente Prisma expõe `number` nos dois casos).
ALTER TABLE "psychosocial_responses" ALTER COLUMN "score" TYPE DOUBLE PRECISION;
