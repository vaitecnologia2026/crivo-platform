-- Chips "Módulos técnicos sugeridos" do card de Solução (texto livre; não afeta liberação).
ALTER TABLE "products" ADD COLUMN "suggestedModules" TEXT[] NOT NULL DEFAULT '{}';
