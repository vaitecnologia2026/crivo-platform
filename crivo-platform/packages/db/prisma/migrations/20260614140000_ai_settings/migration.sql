-- Sprint 2 (auditoria 2.3.1): configuração de IA no Super Admin.
-- ai_settings é CONTROL PLANE (owner-only) — token criptografado (AES-256-GCM).
-- Revogação de crivo_app aplicada por rls.sql (ctrl_tables). Rodar rls.sql após deploy.

CREATE TABLE "ai_settings" (
    "id" UUID NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'global',
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "apiKeyEnc" TEXT,
    "apiKeyIv" TEXT,
    "apiKeyTag" TEXT,
    "apiKeyHint" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "enabledModules" JSONB NOT NULL DEFAULT '[]',
    "lastStatus" TEXT,
    "lastTestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_settings_scope_key" ON "ai_settings"("scope");
