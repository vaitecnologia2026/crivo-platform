-- ORIGENS/CANAIS CADASTRÁVEIS (Governança · Origens e Canais).
--
-- Puramente ADITIVA: cria UMA tabela nova. Nenhuma tabela existente é alterada,
-- nenhuma coluna some, nenhuma linha é tocada. `platform_leads.origin` continua
-- TEXT livre e SEM chave estrangeira — de propósito: leads antigos gravados com
-- origens legadas ("lp-diagnostico", "qrcode"…) continuam válidos e continuam
-- aparecendo nos painéis. Esta tabela é o CATÁLOGO do seletor, não uma restrição.
--
-- As 7 origens canônicas seguem no código (PLATFORM_LEAD_ORIGINS, @crivo/types) e
-- NÃO são inseridas aqui: elas entram na lista como embutidas, não removíveis.
-- Esta tabela guarda só o que o super admin cadastrar ALÉM delas — por isso ela
-- nasce VAZIA e nada muda no comportamento atual até alguém cadastrar a primeira.
--
-- Escrita à mão de propósito: `prisma migrate dev` monta uma shadow database e
-- replica todas as migrations nela, onde `current_tenant()` ainda não existe
-- (a função nasce no passo `rls`/`pre-migrate`), então a geração automática
-- falha com P3006 neste repositório — mesma razão da migration de UTM.
CREATE TABLE "platform_lead_origins" (
  "id"        UUID         NOT NULL DEFAULT gen_random_uuid(),
  "value"     TEXT         NOT NULL,
  "label"     TEXT         NOT NULL,
  "active"    BOOLEAN      NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "platform_lead_origins_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_lead_origins_value_key" ON "platform_lead_origins"("value");

-- CONTROL PLANE, igual a platform_leads: a tabela é global (catálogo comercial da
-- CRIVO, não de um tenant) e só é tocada pelo módulo Admin via prisma.admin, que
-- é a conexão OWNER. Habilitar RLS SEM policy + REVOKE deixa crivo_app (o usuário
-- de runtime, não-owner) sem nenhum acesso — mesma proteção que rls.sql aplica ao
-- resto do control plane. Repetido aqui, e não só no rls.sql, para que a tabela já
-- nasça protegida mesmo quando se roda apenas `prisma migrate deploy`.
ALTER TABLE "platform_lead_origins" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Em bancos onde o papel de aplicação ainda não existe (shadow db, dev limpo),
  -- o REVOKE erraria e derrubaria a migration inteira. Só revoga se houver o quê.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crivo_app') THEN
    EXECUTE 'REVOKE ALL ON "platform_lead_origins" FROM crivo_app';
  END IF;
END
$$;
