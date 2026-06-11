-- AlterEnum: ICD passa do modelo de 5 "padrões" para os 4 Rs (tensão dominante).
-- Recria o tipo DominantPattern com os novos valores. icd_scores é repovoado
-- pelo seed; o cast USING não encontra valores antigos.
BEGIN;
ALTER TYPE "DominantPattern" RENAME TO "DominantPattern_old";
CREATE TYPE "DominantPattern" AS ENUM ('REATIVIDADE', 'RIGIDEZ', 'REPERCUSSAO', 'RISCO', 'EQUILIBRADO');
ALTER TABLE "icd_scores"
  ALTER COLUMN "dominantPattern" TYPE "DominantPattern"
  USING ("dominantPattern"::text::"DominantPattern");
DROP TYPE "DominantPattern_old";
COMMIT;
