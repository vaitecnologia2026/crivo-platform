-- Integrações externas (assinatura/cobrança) + modelos de contrato.

-- CreateTable
CREATE TABLE "platform_integrations" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "credential_enc" TEXT,
    "credential_iv" TEXT,
    "credential_tag" TEXT,
    "credential_hint" TEXT,
    "sandbox" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "platform_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_templates" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contract_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_integrations_provider_key" ON "platform_integrations"("provider");
