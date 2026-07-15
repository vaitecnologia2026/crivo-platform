-- Motor de Diagnósticos aninhado (mockup do cliente 15/07): Dimensão → Subdimensão
-- (parent_slug) com regra de cálculo por nó (aggregation) + pergunta obrigatória/opcional.
-- Aditivo: instrumentos existentes ficam com parent_slug NULL (folhas de topo) — comportamento intacto.
ALTER TABLE "methodology_dimensions"
  ADD COLUMN "parent_slug" TEXT,
  ADD COLUMN "aggregation" "ScoreAggregation";

CREATE INDEX "methodology_dimensions_version_id_parent_slug_idx"
  ON "methodology_dimensions"("version_id", "parent_slug");

ALTER TABLE "methodology_questions"
  ADD COLUMN "required" BOOLEAN NOT NULL DEFAULT true;
