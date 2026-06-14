-- Sprint 1 (Briefing §8/§9): Plano de Ação + Evidências — CORE de todo diagnóstico.
-- Data plane (RLS por tenant): policies de tenant_isolation aplicadas por rls.sql
-- (action_plans/action_items/evidences adicionadas à lista). Rodar rls.sql após deploy.

-- CreateTable: action_plans
CREATE TABLE "action_plans" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT,
    "validatedAt" TIMESTAMP(3),
    "validatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_plans_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "action_plans_tenantId_idx" ON "action_plans"("tenantId");

-- CreateTable: action_items
CREATE TABLE "action_items" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "point" TEXT NOT NULL,
    "origin" TEXT,
    "action" TEXT NOT NULL,
    "responsible" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "ActionStatus" NOT NULL DEFAULT 'SUGERIDA',
    "expectedEvidence" TEXT,
    "reviewDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "action_items_tenantId_idx" ON "action_items"("tenantId");
CREATE INDEX "action_items_planId_idx" ON "action_items"("planId");

-- CreateTable: evidences
CREATE TABLE "evidences" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "itemId" UUID,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidences_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "evidences_tenantId_idx" ON "evidences"("tenantId");
CREATE INDEX "evidences_itemId_idx" ON "evidences"("itemId");

-- Foreign keys
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_planId_fkey" FOREIGN KEY ("planId") REFERENCES "action_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "action_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
