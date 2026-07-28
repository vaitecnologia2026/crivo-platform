-- A4 — PROVENIÊNCIA estruturada do Plano de Evolução: qual diagnóstico do
-- Motor originou o plano/fator (FK no catálogo diagnostic_instruments; os
-- campos de texto livre source/origin são preservados). Migração ADITIVA.
ALTER TABLE "action_plans" ADD COLUMN "source_instrument_slug" TEXT;
ALTER TABLE "action_items" ADD COLUMN "source_instrument_slug" TEXT;

ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_source_instrument_slug_fkey"
  FOREIGN KEY ("source_instrument_slug") REFERENCES "diagnostic_instruments"("slug")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_source_instrument_slug_fkey"
  FOREIGN KEY ("source_instrument_slug") REFERENCES "diagnostic_instruments"("slug")
  ON DELETE SET NULL ON UPDATE CASCADE;
