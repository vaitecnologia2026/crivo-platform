-- Notificações push (FCM) + gates por gatilho. Ambas as tabelas são
-- control-plane (owner-only): acessadas apenas pela conexão owner
-- (prisma.admin). A RLS owner-only é aplicada no sql/rls.sql (ctrl_tables).

-- Override de ativação por canal, 1 linha por gatilho. Ausência = ativo.
CREATE TABLE "notification_settings" (
    "key" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("key")
);

-- Tokens FCM por usuário/dispositivo.
CREATE TABLE "push_tokens" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_tokens_token_key" ON "push_tokens"("token");
CREATE INDEX "push_tokens_userId_idx" ON "push_tokens"("userId");
CREATE INDEX "push_tokens_tenantId_idx" ON "push_tokens"("tenantId");
