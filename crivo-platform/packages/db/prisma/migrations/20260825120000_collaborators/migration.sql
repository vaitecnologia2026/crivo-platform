-- Colaboradores: funcionários cadastrados pelo cliente para responder o
-- diagnóstico contratado. Cada um tem um TOKEN de link único (/r/<token>);
-- o CPF cadastrado valida o acesso e `responded_at` impede refazer. A RESPOSTA
-- continua anônima (psychosocial_responses/diagnostic_responses) e NÃO aponta
-- para esta linha.
--
-- Migration escrita à MÃO (padrão do repo): `prisma migrate dev` quebra (P3006)
-- porque a shadow DB não tem current_tenant(). Usar `prisma migrate deploy`.
CREATE TABLE "collaborators" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "sector" TEXT,
    "email" TEXT,
    "cpf" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "invite_email_at" TIMESTAMP(3),
    "invite_whatsapp_at" TIMESTAMP(3),
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "collaborators_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "collaborators_tenantId_fkey" FOREIGN KEY ("tenantId")
      REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "collaborators_token_key" ON "collaborators"("token");
CREATE UNIQUE INDEX "collaborators_tenantId_cpf_key" ON "collaborators"("tenantId", "cpf");
CREATE INDEX "collaborators_tenantId_idx" ON "collaborators"("tenantId");

-- RLS: tabela do data plane, isolada por tenant (mesmo padrão de diagnostic_*).
ALTER TABLE "collaborators" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "collaborators" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "collaborators"
  USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant());
GRANT SELECT, INSERT, UPDATE, DELETE ON "collaborators" TO crivo_app;
