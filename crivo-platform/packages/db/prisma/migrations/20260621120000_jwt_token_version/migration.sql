-- Revogação de JWT (logout / troca de senha / desativação).
-- Cada token passa a carregar a versão (`tv`) vigente do usuário no momento da
-- emissão; o guard de auth rejeita o token se `tv` divergir da versão atual.
-- Incrementar a versão invalida, de uma vez, TODOS os tokens daquele usuário.
ALTER TABLE "users" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "super_admins" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
