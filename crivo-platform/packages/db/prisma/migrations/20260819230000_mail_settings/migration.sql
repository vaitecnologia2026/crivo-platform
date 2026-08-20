-- CONTA DE E-MAIL DE ENVIO (Governança · E-mail de envio).
--
-- Puramente ADITIVA: cria UMA tabela nova. Nenhuma tabela existente é alterada,
-- nenhuma coluna some, nenhuma linha é tocada.
--
-- A tabela nasce VAZIA e nada muda no comportamento atual até alguém salvar a
-- primeira conta E marcá-la como ativa: sem linha ativa, o envio continua
-- usando as variáveis SMTP_* do ambiente, exatamente como antes.
--
-- LINHA ÚNICA por design: é UMA conta que dispara as mensagens da plataforma.
--
-- A senha do SMTP é guardada CIFRADA (AES-256-GCM, chave derivada de
-- AUTH_SECRET — ver secret-crypto.ts). As colunas password_enc/iv/tag guardam o
-- ciphertext, o IV e a auth tag; password_hint guarda só os 4 últimos
-- caracteres, para conferência visual no painel. A senha em claro NUNCA é
-- gravada e NUNCA é devolvida pela API.
--
-- Escrita à mão de propósito: `prisma migrate dev` monta uma shadow database e
-- replica todas as migrations nela, onde `current_tenant()` ainda não existe
-- (a função nasce no passo `rls`/`pre-migrate`), então a geração automática
-- falha com P3006 neste repositório — mesma razão da migration de origens.
CREATE TABLE "mail_settings" (
  "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
  "enabled"       BOOLEAN      NOT NULL DEFAULT false,
  "host"          TEXT         NOT NULL,
  "port"          INTEGER      NOT NULL DEFAULT 465,
  "secure"        BOOLEAN      NOT NULL DEFAULT true,
  "smtp_user"     TEXT         NOT NULL,
  "from_name"     TEXT,
  "from_email"    TEXT         NOT NULL,
  "password_enc"  TEXT         NOT NULL,
  "password_iv"   TEXT         NOT NULL,
  "password_tag"  TEXT         NOT NULL,
  "password_hint" TEXT         NOT NULL,
  "updated_at"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "mail_settings_pkey" PRIMARY KEY ("id")
);

-- CONTROL PLANE, igual a platform_integrations e ebook_assets: a tabela é global
-- (a conta de envio da CRIVO, não de um tenant), guarda credencial e só é tocada
-- pelo módulo Admin via prisma.admin, que é a conexão OWNER. Habilitar RLS SEM
-- policy + REVOKE deixa crivo_app (o usuário de runtime, não-owner) sem nenhum
-- acesso — mesma proteção que rls.sql aplica ao resto do control plane. Repetido
-- aqui, e não só no rls.sql, para que a tabela já nasça protegida mesmo quando
-- se roda apenas `prisma migrate deploy`.
ALTER TABLE "mail_settings" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Em bancos onde o papel de aplicação ainda não existe (shadow db, dev limpo),
  -- o REVOKE erraria e derrubaria a migration inteira. Só revoga se houver o quê.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crivo_app') THEN
    EXECUTE 'REVOKE ALL ON "mail_settings" FROM crivo_app';
  END IF;
END
$$;
