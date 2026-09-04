-- Biblioteca de Riscos/Fatores Psicossociais (Orientacao Funcional v1.0, 5.1).
-- Cinco colunas ADITIVAS. `status` nasce ATIVO em todas as linhas existentes,
-- entao nenhum fator sai da matriz por causa desta migration.
ALTER TABLE "methodology_factors"
  ADD COLUMN "code" TEXT,
  ADD COLUMN "definition" TEXT,
  ADD COLUMN "source_context" TEXT,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ATIVO',
  ADD COLUMN "factor_version" TEXT;
