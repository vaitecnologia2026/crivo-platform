-- Catálogo de Soluções (Tela 03 · Incluir): enquadramento comercial da solução.
ALTER TABLE "products" ADD COLUMN "appearsOnLp" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "products" ADD COLUMN "sellableStandalone" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "products" ADD COLUMN "canBeAddon" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "products" ADD COLUMN "allowsAi" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "products" ADD COLUMN "allowsCustomAi" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "products" ADD COLUMN "allowedAddons" TEXT[] NOT NULL DEFAULT '{}';
