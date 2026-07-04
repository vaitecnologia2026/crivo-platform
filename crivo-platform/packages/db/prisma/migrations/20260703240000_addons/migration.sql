-- Modelo Adicional com preço + recorrência (Tela 05 · pendência #2 do caderno).
CREATE TABLE "addons" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "moduleCode" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "monthlyPriceCents" INTEGER NOT NULL DEFAULT 0,
  "setupPriceCents" INTEGER NOT NULL DEFAULT 0,
  "recurring" BOOLEAN NOT NULL DEFAULT true,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "addons_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "addons_moduleCode_key" ON "addons"("moduleCode");
