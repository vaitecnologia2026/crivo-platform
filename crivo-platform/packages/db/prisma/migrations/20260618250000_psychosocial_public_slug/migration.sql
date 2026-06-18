-- Link público anônimo do Questionário Psicossocial (Briefing §6). Slug por
-- empresa em organizations; respondente acessa /q/<slug> sem login. Coluna
-- aditiva e nullable — backfill sob demanda (gerado no portal). Aplica no boot
-- (railway.json: migrate deploy && start).

ALTER TABLE "organizations" ADD COLUMN "psychosocialSlug" TEXT;
CREATE UNIQUE INDEX "organizations_psychosocialSlug_key" ON "organizations"("psychosocialSlug");
