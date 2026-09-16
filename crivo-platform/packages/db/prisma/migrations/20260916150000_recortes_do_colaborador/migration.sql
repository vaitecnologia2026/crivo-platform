-- Recortes do colaborador — Ajustes Finais de Homologação (Colaboradores/CSV).
--
-- Cadastro ganha Unidade, Área, Cargo/Função, Turno, GHE/Grupo de Exposição,
-- Gestor e Modelo de trabalho; Sexo/Gênero e Ano de nascimento/Faixa etária
-- são opcionais. "Processo" NÃO entra (é dado do fator/ação, validado caso a
-- caso). GHE é informado pela empresa — nunca inferido.
--
-- A resposta (anônima) recebe `cohort`: um RETRATO só desses atributos no
-- momento do envio — nunca nome, CPF, e-mail ou telefone —, do mesmo jeito que
-- `sector` já viajava. É por ele que o Dossiê agrupa (GHE preferencial; sem
-- GHE, Área/Setor) e que o portal oferece os demais recortes, sempre com a
-- supressão por mínimo de respondentes.
--
-- ADITIVA e NULLABLE: nenhuma linha existente muda.
ALTER TABLE "collaborators"
  ADD COLUMN "unit" TEXT,
  ADD COLUMN "area" TEXT,
  ADD COLUMN "role" TEXT,
  ADD COLUMN "shift" TEXT,
  ADD COLUMN "ghe" TEXT,
  ADD COLUMN "manager" TEXT,
  ADD COLUMN "work_model" TEXT,
  ADD COLUMN "gender" TEXT,
  ADD COLUMN "birth_year" INTEGER,
  ADD COLUMN "age_band" TEXT;

ALTER TABLE "diagnostic_responses" ADD COLUMN "cohort" JSONB;
ALTER TABLE "psychosocial_responses" ADD COLUMN "cohort" JSONB;
