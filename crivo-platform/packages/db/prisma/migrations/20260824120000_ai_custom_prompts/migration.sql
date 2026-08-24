-- IA — PROMPTS PERSONALIZADOS do super admin (aba Prompts e Políticas).
--
-- Puramente ADITIVA: cria DUAS tabelas novas. Nenhuma tabela existente é
-- alterada, nenhuma coluna some, nenhuma linha é tocada. As tabelas nascem
-- VAZIAS e nada muda no comportamento atual até o super admin salvar o
-- primeiro prompt personalizado (sem linha ativa, o Dossiê continua usando o
-- prompt fixo em código, exatamente como antes).
--
-- ai_custom_prompts: prompt livre, opcionalmente vinculado a um diagnóstico do
-- Motor (instrument_slug) e a adicionais contratados (addon_ids = moduleCode[]).
-- ai_custom_prompt_files: material de referência anexado — guarda só o TEXTO
-- extraído (pdf/docx/xlsx/txt/md/csv); o binário original não é persistido.
--
-- Escrita à mão de propósito: `prisma migrate dev` monta uma shadow database e
-- replica todas as migrations nela, onde `current_tenant()` ainda não existe
-- (a função nasce no passo `rls`/`pre-migrate`), então a geração automática
-- falha com P3006 neste repositório — mesma razão da migration de mail_settings.
CREATE TABLE "ai_custom_prompts" (
  "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
  "name"            TEXT         NOT NULL,
  "body"            TEXT         NOT NULL,
  "instrument_slug" TEXT,
  "addon_ids"       JSONB        NOT NULL DEFAULT '[]',
  "active"          BOOLEAN      NOT NULL DEFAULT true,
  "updated_by"      TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ai_custom_prompts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_custom_prompt_files" (
  "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
  "prompt_id"      UUID         NOT NULL,
  "filename"       TEXT         NOT NULL,
  "mime_type"      TEXT         NOT NULL,
  "size_bytes"     INTEGER      NOT NULL,
  "extracted_text" TEXT         NOT NULL,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_custom_prompt_files_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_custom_prompt_files_prompt_id_idx" ON "ai_custom_prompt_files"("prompt_id");

ALTER TABLE "ai_custom_prompt_files" ADD CONSTRAINT "ai_custom_prompt_files_prompt_id_fkey"
  FOREIGN KEY ("prompt_id") REFERENCES "ai_custom_prompts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- CONTROL PLANE, igual a mail_settings e ebook_assets: tabelas globais da CRIVO,
-- tocadas só pelo módulo Admin via prisma.admin (conexão OWNER). Habilitar RLS
-- SEM policy + REVOKE deixa crivo_app (o usuário de runtime, não-owner) sem
-- nenhum acesso — mesma proteção que rls.sql aplica ao resto do control plane.
-- Repetido aqui, e não só no rls.sql, para que as tabelas já nasçam protegidas
-- mesmo quando se roda apenas `prisma migrate deploy`.
ALTER TABLE "ai_custom_prompts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_custom_prompt_files" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Em bancos onde o papel de aplicação ainda não existe (shadow db, dev limpo),
  -- o REVOKE erraria e derrubaria a migration inteira. Só revoga se houver o quê.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crivo_app') THEN
    EXECUTE 'REVOKE ALL ON "ai_custom_prompts" FROM crivo_app';
    EXECUTE 'REVOKE ALL ON "ai_custom_prompt_files" FROM crivo_app';
  END IF;
END
$$;
