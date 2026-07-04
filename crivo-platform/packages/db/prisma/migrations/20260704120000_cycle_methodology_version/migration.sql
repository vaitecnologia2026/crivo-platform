-- Tela 08 [3]: cada ciclo guarda a versão de metodologia aplicada (rastreabilidade).
ALTER TABLE "assessment_cycles" ADD COLUMN "methodologyVersionId" UUID;
