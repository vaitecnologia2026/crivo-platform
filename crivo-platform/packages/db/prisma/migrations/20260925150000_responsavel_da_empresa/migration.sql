-- RESPONSÁVEL DA EMPRESA pela emissão oficial dos documentos técnicos.
--
-- ADITIVA e NULLABLE: nenhuma linha existente muda.
--
-- Por que existe: a emissão oficial exigia "responsável da empresa", mas lia
-- contracts.responsible — o responsável CRIVO pelo contrato (usuário do Super
-- Admin). A empresa informa o seu responsável em "Minha Organização".
ALTER TABLE "organizations" ADD COLUMN "responsible_name" TEXT;
