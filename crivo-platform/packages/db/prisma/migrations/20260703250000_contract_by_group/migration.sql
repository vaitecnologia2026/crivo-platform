-- Contrato por GRUPO (Tela 05 [5]): organizationId opcional + groupId (um dos dois).
ALTER TABLE "contracts" ALTER COLUMN "organizationId" DROP NOT NULL;
ALTER TABLE "contracts" ADD COLUMN "groupId" UUID;
CREATE INDEX "contracts_groupId_idx" ON "contracts"("groupId");
