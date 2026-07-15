-- Governança de evidências (mockup do cliente 14/07): a CRIVO aprova/rejeita/
-- substitui evidências enviadas pelo cliente.
CREATE TYPE "EvidenceStatus" AS ENUM ('ENVIADA', 'PENDENTE', 'APROVADA', 'REJEITADA', 'SUBSTITUIDA');

ALTER TABLE "evidences"
  ADD COLUMN "status" "EvidenceStatus" NOT NULL DEFAULT 'ENVIADA',
  ADD COLUMN "author" TEXT,
  ADD COLUMN "reviewed_at" TIMESTAMP(3),
  ADD COLUMN "reviewed_by" TEXT,
  ADD COLUMN "rejection_reason" TEXT,
  ADD COLUMN "superseded_by_id" UUID;

CREATE INDEX "evidences_status_idx" ON "evidences"("status");
