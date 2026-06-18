-- Dados cadastrais da empresa (autoatendimento na tela "Organização" do portal):
-- razão social, CNPJ, site e telefone. Colunas aditivas e nullable. Aplica no
-- boot (railway.json: migrate deploy && start).

ALTER TABLE "organizations" ADD COLUMN "legalName" TEXT;
ALTER TABLE "organizations" ADD COLUMN "taxId" TEXT;
ALTER TABLE "organizations" ADD COLUMN "website" TEXT;
ALTER TABLE "organizations" ADD COLUMN "phone" TEXT;
