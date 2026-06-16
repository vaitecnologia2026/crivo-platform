-- Soft-delete em Decision (#77) — preserva o registro para auditoria (Anexo §17).
-- NULL = ativo; timestamp = removido. Lê filtram por deletedAt IS NULL.

ALTER TABLE "decisions" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Index para acelerar `WHERE deletedAt IS NULL` em listas/dashboards.
CREATE INDEX "decisions_deletedAt_idx" ON "decisions"("deletedAt");
