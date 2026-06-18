-- Acesso por TELA por usuário (gestão de equipe no portal). Lista de rotas que o
-- usuário pode acessar; null = sem restrição (papel/módulo decidem). Coluna
-- aditiva e nullable. Aplica no boot (railway.json: migrate deploy && start).

ALTER TABLE "users" ADD COLUMN "screenAccess" JSONB;
