-- Rede de seguranca do Plano de Evolucao, escrita pela IA.
--
-- Puramente ADITIVA: cria UMA tabela nova, que nasce VAZIA. Nada muda no
-- comportamento ate a IA gerar o primeiro plano; enquanto a tabela estiver
-- vazia, o sistema se comporta exatamente como hoje.
--
-- Por que existe: a biblioteca embutida em codigo e chaveada por 6 slugs fixos
-- (demandas, controle, apoio, reconhecimento, clareza, relacoes). Numa
-- metodologia montada pelo cliente os slugs sao dim-1, dim-2, ... e a
-- interseccao e VAZIA — medido em producao: 9 e 14 fatores com plano
-- obrigatorio e ZERO sugestao sempre que a IA falhava. Aqui fica guardado o
-- texto que a propria IA escreveu para cada fator.
--
-- Sem tenantId de proposito: o prompt so leva rotulo do fator e numeros de
-- risco, nenhum dado da empresa, entao a entrada serve qualquer tenant do
-- mesmo instrumento.
--
-- Escrita a mao: `prisma migrate dev` monta shadow database sem
-- `current_tenant()` e falha com P3006 neste repositorio (mesma razao das
-- migrations de mail_settings e ai_custom_prompts).
CREATE TABLE "factor_action_plans" (
  "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
  "instrument_slug" TEXT         NOT NULL,
  "factor_slug"     TEXT         NOT NULL,
  "factor_label"    TEXT         NOT NULL,
  "descricao"       TEXT         NOT NULL,
  "objetivo"        TEXT         NOT NULL,
  "acoes"           JSONB        NOT NULL,
  "origin"          TEXT         NOT NULL DEFAULT 'IA',
  "generated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "factor_action_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "factor_action_plans_instrument_slug_factor_slug_key"
  ON "factor_action_plans" ("instrument_slug", "factor_slug");
CREATE INDEX "factor_action_plans_instrument_slug_idx"
  ON "factor_action_plans" ("instrument_slug");

-- CONTROL PLANE, igual a ai_custom_prompts e mail_settings: tabela global da
-- CRIVO, tocada so via prisma.admin (conexao OWNER). RLS sem policy + REVOKE
-- deixa crivo_app sem nenhum acesso.
ALTER TABLE "factor_action_plans" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crivo_app') THEN
    EXECUTE 'REVOKE ALL ON "factor_action_plans" FROM crivo_app';
  END IF;
END
$$;
