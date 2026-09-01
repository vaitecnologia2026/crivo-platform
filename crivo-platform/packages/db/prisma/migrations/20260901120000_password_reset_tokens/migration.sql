-- Recuperação de senha do portal (auto-atendimento). Até aqui "Esqueci minha
-- senha" abria o WhatsApp do suporte: a redefinição era manual, humana e sem
-- registro. Agora o usuário pede pelo e-mail, recebe um link de USO ÚNICO com
-- validade curta e define a senha nova.
--
-- Guardamos só o HASH (sha256) do token: um dump do banco não permite redefinir
-- a senha de ninguém. `used_at` fecha o uso único; `expires_at` fecha a janela.
--
-- O e-mail NÃO é único na plataforma (users tem @@unique([tenantId, email])),
-- então o token é por USUÁRIO — o e-mail enviado lista uma opção por empresa.
--
-- Migration escrita à MÃO (padrão do repo): `prisma migrate dev` quebra (P3006)
-- porque a shadow DB não tem current_tenant(). Usar `prisma migrate deploy`.
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "password_reset_tokens_tenantId_fkey" FOREIGN KEY ("tenantId")
      REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId")
      REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");
CREATE INDEX "password_reset_tokens_tenantId_idx" ON "password_reset_tokens"("tenantId");

-- RLS: tabela do data plane, isolada por tenant (mesmo padrão de collaborators).
-- A resolução do token é PÚBLICA (sem sessão, sem tenant no contexto) e roda
-- pela conexão owner com `// rls-allow:` — o token é a própria credencial.
ALTER TABLE "password_reset_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "password_reset_tokens" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "password_reset_tokens"
  USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant());
GRANT SELECT, INSERT, UPDATE, DELETE ON "password_reset_tokens" TO crivo_app;
