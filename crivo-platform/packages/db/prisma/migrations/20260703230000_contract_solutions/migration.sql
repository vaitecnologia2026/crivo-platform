-- Contratos (Tela 05): várias soluções no mesmo contrato (composição real do cliente).
ALTER TABLE "contracts" ADD COLUMN "solutionIds" TEXT[] NOT NULL DEFAULT '{}';
