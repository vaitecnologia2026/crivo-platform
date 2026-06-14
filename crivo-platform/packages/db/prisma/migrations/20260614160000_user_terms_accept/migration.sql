-- Aceite de termos/LGPD no 1º acesso (Briefing · Matriz §Confidencialidade).
-- Colunas em users (data plane — policy de tenant já existente).
ALTER TABLE "users" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "termsVersion" TEXT;
