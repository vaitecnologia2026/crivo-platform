-- Sprint 1 (Briefing Funcional + Matriz v5): contrato por cliente + método × saída técnica.
-- contracts é CONTROL PLANE (owner-only) — revogação de crivo_app aplicada por rls.sql.

-- CreateEnum
CREATE TYPE "DiagnosticMethod" AS ENUM ('INICIAL', 'ESSENCIAL', 'ORGANIZACIONAL');
CREATE TYPE "TechnicalOutput" AS ENUM ('SEM_INTEGRACAO', 'AEP', 'AEP_PGR');
CREATE TYPE "ContractModel" AS ENUM ('PONTUAL', 'SEIS_MESES', 'DOZE_MESES', 'VINTE_QUATRO_MESES', 'CUSTOM');
CREATE TYPE "ContractStatus" AS ENUM ('RASCUNHO', 'ATIVO', 'SUSPENSO', 'ENCERRADO');
CREATE TYPE "ActionStatus" AS ENUM ('SUGERIDA', 'EM_REVISAO', 'APROVADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'REAVALIADA');

-- AlterTable: Product — método CRIVO + saídas técnicas + módulos CORE
ALTER TABLE "products" ADD COLUMN "method" "DiagnosticMethod";
ALTER TABLE "products" ADD COLUMN "coreModules" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "products" ADD COLUMN "supportedOutputs" JSONB NOT NULL DEFAULT '[]';

-- CreateTable: contracts
CREATE TABLE "contracts" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "productId" UUID,
    "model" "ContractModel" NOT NULL DEFAULT 'PONTUAL',
    "status" "ContractStatus" NOT NULL DEFAULT 'RASCUNHO',
    "method" "DiagnosticMethod",
    "technicalOutput" "TechnicalOutput" NOT NULL DEFAULT 'SEM_INTEGRACAO',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "accessDays" INTEGER,
    "rounds" INTEGER NOT NULL DEFAULT 1,
    "maxRespondents" INTEGER NOT NULL DEFAULT 0,
    "maxLeaders" INTEGER NOT NULL DEFAULT 0,
    "optionalModules" JSONB NOT NULL DEFAULT '[]',
    "responsible" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contracts_organizationId_idx" ON "contracts"("organizationId");
CREATE INDEX "contracts_status_idx" ON "contracts"("status");
