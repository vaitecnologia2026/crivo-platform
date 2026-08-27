-- Diagnóstico Essencial em empresas pequenas.
--
-- 1) `origin` na resposta: distingue a AUTOAVALIAÇÃO do gestor (respondida no
--    painel) da resposta que chega por link. Existe uma por empresa — refazer
--    substitui, para o agregado não inflar a cada revisão.
-- 2) `min_respondents` por empresa: o padrão global (5) inviabiliza qualquer
--    resultado numa empresa de 3 funcionários. null = usa o padrão global, então
--    nada muda para quem já está no ar.
--
-- Ambas aditivas e nullable. Migration à MÃO (padrão do repo) — `migrate dev`
-- quebra (P3006, shadow DB sem current_tenant()). Usar `prisma migrate deploy`.
ALTER TABLE "diagnostic_responses" ADD COLUMN "origin" TEXT;
ALTER TABLE "organizations" ADD COLUMN "min_respondents" INTEGER;
