-- Contextos do cliente (Spec V1 v1.2 §3): Minha Jornada × Área da Organização.
-- O papel corporativo continua em "role"; "is_leader" marca quem TAMBÉM é líder
-- (Líder + Administrador, um único login). Somente aditiva.
ALTER TABLE "users" ADD COLUMN "is_leader" BOOLEAN NOT NULL DEFAULT false;

-- Somente Líder: o papel LIDER é sempre líder.
UPDATE "users" SET "is_leader" = true WHERE "role" = 'LIDER';

-- Quem já usa a Área do Líder com outro papel (registrou decisão ou sessão do
-- Pocket) continua com Minha Jornada: a partir desta versão as rotas privadas
-- do líder exigem ser líder, e sem isto a pessoa perderia o acesso às próprias
-- decisões e reflexões. Esses registros já entram no ICD da empresa, então
-- marcá-la como líder também alinha o total de líderes elegíveis ao agregado.
UPDATE "users" u
SET "is_leader" = true
WHERE u."is_leader" = false
  AND (
    EXISTS (SELECT 1 FROM "decisions" d WHERE d."leaderId" = u."id" AND d."deletedAt" IS NULL)
    OR EXISTS (SELECT 1 FROM "pocket_sessions" p WHERE p."leaderId" = u."id")
  );

-- Somente Líder não usa a checklist de telas por usuário: ela passa a ser só da
-- Área da Organização (Minha Jornada é governada pelo contrato) e a UI não a
-- mostra mais para o papel LIDER — uma lista antiga (ex.: 'lider','pocket',
-- 'decisoes') ficaria presa, sem como corrigir pela tela. NULL = sem restrição.
UPDATE "users" SET "screenAccess" = NULL WHERE "role" = 'LIDER';
