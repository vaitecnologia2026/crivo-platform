-- Upload real de evidências (Briefing §9). Metadados ficam em "evidences"
-- (colunas aditivas, nullable); os BYTES ficam em "evidence_files" (1:1), para
-- não trafegar arquivo em listagens. Data plane (RLS por tenant em rls.sql).

ALTER TABLE "evidences" ADD COLUMN "fileName" TEXT;
ALTER TABLE "evidences" ADD COLUMN "fileMime" TEXT;
ALTER TABLE "evidences" ADD COLUMN "fileSize" INTEGER;

CREATE TABLE "evidence_files" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "evidenceId" UUID NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_files_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "evidence_files_evidenceId_key" ON "evidence_files"("evidenceId");
CREATE INDEX "evidence_files_tenantId_idx" ON "evidence_files"("tenantId");

ALTER TABLE "evidence_files" ADD CONSTRAINT "evidence_files_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
