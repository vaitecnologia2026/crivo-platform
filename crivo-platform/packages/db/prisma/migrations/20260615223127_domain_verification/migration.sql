-- Verificação de domínio do tenant (#55):
-- - verificationToken: token TXT que o cliente publica em _crivo.<domain>
-- - verifiedAt: timestamp da confirmação
-- - lastVerifyAttempt + lastVerifyError: trail das tentativas

ALTER TABLE "tenant_domains"
  ADD COLUMN "verificationToken" TEXT,
  ADD COLUMN "verifiedAt" TIMESTAMP(3),
  ADD COLUMN "lastVerifyAttempt" TIMESTAMP(3),
  ADD COLUMN "lastVerifyError" TEXT;
