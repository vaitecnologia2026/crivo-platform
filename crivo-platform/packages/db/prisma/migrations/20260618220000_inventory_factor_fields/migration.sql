-- Inventário estruturado de fatores psicossociais (Briefing §6/§15): dimensões
-- que transformam o ponto do plano de ação num fator de risco para o PGR.
-- Colunas aditivas, nullable — não afetam itens existentes.
ALTER TABLE "action_items" ADD COLUMN "exposedGroup" TEXT;
ALTER TABLE "action_items" ADD COLUMN "riskLevel" TEXT;
