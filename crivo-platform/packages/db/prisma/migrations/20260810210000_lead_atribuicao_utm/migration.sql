-- ATRIBUIÇÃO DO LEAD (§11/§15 dos Ajustes Finais do Site).
-- "de onde o visitante veio" e "qual campanha gerou o lead".
--
-- Puramente ADITIVA: sete colunas novas, todas NULL-áveis e sem default. Nenhuma
-- linha existente é tocada; leads antigos ficam com atribuição vazia, que é a
-- verdade (não havia captura antes).
--
-- Colunas nomeadas em vez de um JSON porque o comercial precisa AGRUPAR
-- ("quantos leads vieram da campanha X") — JSON não se agrupa bem. Daí também o
-- índice em utm_campaign, que é o recorte do relatório.
--
-- Escrita à mão de propósito: `prisma migrate dev` monta uma shadow database e
-- replica todas as migrations nela, onde `current_tenant()` ainda não existe
-- (a função nasce no passo `rls`/`pre-migrate`), então a geração automática
-- falha com P3006 neste repositório.
ALTER TABLE "platform_leads"
  ADD COLUMN "utm_source"   TEXT,
  ADD COLUMN "utm_medium"   TEXT,
  ADD COLUMN "utm_campaign" TEXT,
  ADD COLUMN "utm_content"  TEXT,
  ADD COLUMN "utm_term"     TEXT,
  ADD COLUMN "referrer"     TEXT,
  ADD COLUMN "landing_page" TEXT;

CREATE INDEX "platform_leads_utm_campaign_idx" ON "platform_leads"("utm_campaign");
