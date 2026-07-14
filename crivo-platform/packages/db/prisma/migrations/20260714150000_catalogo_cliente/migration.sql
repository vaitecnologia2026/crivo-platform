-- Catálogo no padrão do cliente (mockups 14/07): vitrine das Soluções + tabela de Adicionais.

-- Enums do Adicional
CREATE TYPE "AddonRecurrence" AS ENUM ('MENSAL', 'POR_CICLO', 'UNICO', 'POR_SESSAO');
CREATE TYPE "AddonStatus" AS ENUM ('ATIVO', 'EM_REVISAO', 'AGUARDANDO_DADOS');

-- Product: campos de apresentação do card de Solução
ALTER TABLE "products"
  ADD COLUMN "category" TEXT,
  ADD COLUMN "coreDelivery" TEXT,
  ADD COLUMN "implementation" TEXT,
  ADD COLUMN "priceLabel" TEXT,
  ADD COLUMN "modalities" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "suggestedAddons" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "compatiblePackages" TEXT[] NOT NULL DEFAULT '{}';

-- Addon: catálogo de upsells completo
ALTER TABLE "addons"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "category" TEXT,
  ADD COLUMN "recurrence" "AddonRecurrence" NOT NULL DEFAULT 'MENSAL',
  ADD COLUMN "priceLabel" TEXT,
  ADD COLUMN "compatibleSolutions" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "activatedModules" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "limitsNote" TEXT,
  ADD COLUMN "dependenciesNote" TEXT,
  ADD COLUMN "releaseRule" TEXT,
  ADD COLUMN "statusEx" "AddonStatus" NOT NULL DEFAULT 'ATIVO';

-- Sincroniza recurrence/statusEx com os booleanos existentes
UPDATE "addons" SET "recurrence" = 'UNICO' WHERE "recurring" = false;
UPDATE "addons" SET "statusEx" = 'EM_REVISAO' WHERE "active" = false;
