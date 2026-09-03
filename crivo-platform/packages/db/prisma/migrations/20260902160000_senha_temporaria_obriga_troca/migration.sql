-- Senha definida PELA PLATAFORMA (criação do cliente, "enviar acesso" do CRM,
-- redefinição pelo super admin) passa a exigir troca no primeiro acesso.
-- Aditiva e com default: usuários existentes nascem com false, então ninguém
-- que já usa o portal é surpreendido com uma tela de troca.
ALTER TABLE "users" ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;
