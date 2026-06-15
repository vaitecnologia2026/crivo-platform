-- Parecer Consultivo CRIVO (Briefing §6) — módulo de autoria do consultor.
-- Data plane (RLS por tenant): policy tenant_isolation aplicada por rls.sql
-- (pareceres adicionada à lista). Rodar rls.sql após deploy (pnpm db:rls).

CREATE TABLE "pareceres" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "context" TEXT,
    "signals" TEXT,
    "hypotheses" TEXT,
    "priorities" TEXT,
    "recommendations" TEXT,
    "author" TEXT,
    "devolutivaAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pareceres_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pareceres_tenantId_idx" ON "pareceres"("tenantId");

ALTER TABLE "pareceres" ADD CONSTRAINT "pareceres_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
