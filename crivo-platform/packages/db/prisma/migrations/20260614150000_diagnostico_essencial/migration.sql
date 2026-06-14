-- Sprint 3 (Briefing §5): jornada Diagnóstico Essencial — autoavaliação guiada
-- + registro de escuta/observação. Data plane (RLS por tenant): policies de
-- tenant_isolation aplicadas por rls.sql. Rodar rls.sql após deploy.

-- CreateEnum
CREATE TYPE "EssentialRecordKind" AS ENUM ('ESCUTA', 'OBSERVACAO');

-- CreateTable: self_assessments
CREATE TABLE "self_assessments" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "answers" JSONB NOT NULL,
    "score" INTEGER NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "self_assessments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "self_assessments_tenantId_idx" ON "self_assessments"("tenantId");

-- CreateTable: essential_records
CREATE TABLE "essential_records" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "kind" "EssentialRecordKind" NOT NULL,
    "title" TEXT NOT NULL,
    "recordDate" TIMESTAMP(3),
    "participants" TEXT,
    "notes" TEXT,
    "points" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "essential_records_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "essential_records_tenantId_idx" ON "essential_records"("tenantId");

-- Foreign keys
ALTER TABLE "self_assessments" ADD CONSTRAINT "self_assessments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "essential_records" ADD CONSTRAINT "essential_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
