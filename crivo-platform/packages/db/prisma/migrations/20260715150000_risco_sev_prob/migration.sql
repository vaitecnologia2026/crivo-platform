-- Matriz de risco do dossiê (doc 09 §6): severidade x probabilidade como
-- ENTRADAS; o risco técnico passa a ser derivado delas. Migração ADITIVA —
-- registros existentes seguem com riskLevel manual até serem reclassificados.
ALTER TABLE "action_items" ADD COLUMN "severity" TEXT;
ALTER TABLE "action_items" ADD COLUMN "probability" TEXT;
