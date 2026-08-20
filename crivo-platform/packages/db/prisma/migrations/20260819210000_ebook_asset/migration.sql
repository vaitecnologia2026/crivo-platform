-- E-BOOK IMPORTÁVEL (Governança · E-book).
--
-- Puramente ADITIVA: cria UMA tabela nova. Nenhuma tabela existente é alterada,
-- nenhuma coluna some, nenhuma linha é tocada.
--
-- A tabela nasce VAZIA e nada muda no comportamento atual até alguém importar o
-- primeiro arquivo: enquanto não houver linha, o e-mail e o WhatsApp continuam
-- usando o PDF estático da LP (EBOOK_URL), exatamente como antes.
--
-- LINHA ÚNICA por design: importar de novo SUBSTITUI o arquivo atual. O disparo
-- precisa de UM e-book corrente, sem ambiguidade sobre qual sai.
--
-- Escrita à mão de propósito: `prisma migrate dev` monta uma shadow database e
-- replica todas as migrations nela, onde `current_tenant()` ainda não existe
-- (a função nasce no passo `rls`/`pre-migrate`), então a geração automática
-- falha com P3006 neste repositório — mesma razão da migration de origens.
CREATE TABLE "ebook_assets" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "name"       TEXT         NOT NULL,
  "file_name"  TEXT         NOT NULL,
  "mime_type"  TEXT         NOT NULL,
  "size_bytes" INTEGER      NOT NULL,
  "data"       TEXT         NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ebook_assets_pkey" PRIMARY KEY ("id")
);

-- CONTROL PLANE, igual a platform_leads e platform_lead_origins: a tabela é
-- global (um único e-book da CRIVO, não de um tenant) e só é tocada pelo módulo
-- Admin via prisma.admin, que é a conexão OWNER. Habilitar RLS SEM policy +
-- REVOKE deixa crivo_app (o usuário de runtime, não-owner) sem nenhum acesso —
-- mesma proteção que rls.sql aplica ao resto do control plane. Repetido aqui, e
-- não só no rls.sql, para que a tabela já nasça protegida mesmo quando se roda
-- apenas `prisma migrate deploy`.
ALTER TABLE "ebook_assets" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Em bancos onde o papel de aplicação ainda não existe (shadow db, dev limpo),
  -- o REVOKE erraria e derrubaria a migration inteira. Só revoga se houver o quê.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crivo_app') THEN
    EXECUTE 'REVOKE ALL ON "ebook_assets" FROM crivo_app';
  END IF;
END
$$;
