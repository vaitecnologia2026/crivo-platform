-- Grupos e Empresas-cliente (Tela 06 · Incluir): CNPJ, matriz/filial e responsável interno.
ALTER TABLE "tenants" ADD COLUMN "cnpj" TEXT;
ALTER TABLE "tenants" ADD COLUMN "headquarterType" TEXT;
ALTER TABLE "tenants" ADD COLUMN "internalResponsible" TEXT;
