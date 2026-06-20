-- Cargos Financeiro e Visualizador (Briefing item 5/6) — passo 1/2: enum.
-- ADD VALUE em migration própria (separada do catálogo) porque um valor de enum
-- recém-criado não pode ser USADO na mesma transação em que é adicionado.
-- IDEMPOTENTE (IF NOT EXISTS). O catálogo RBAC vem na migration seguinte.

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'FINANCEIRO';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'VISUALIZADOR';
