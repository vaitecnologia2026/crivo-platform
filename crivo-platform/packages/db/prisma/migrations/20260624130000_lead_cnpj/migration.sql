-- Enriquecimento do lead por CNPJ (BrasilAPI) — base do grau de risco (NR-1).
ALTER TABLE "platform_leads" ADD COLUMN "cnpj" TEXT;
ALTER TABLE "platform_leads" ADD COLUMN "cnpjData" JSONB;
ALTER TABLE "platform_leads" ADD COLUMN "riskGrade" TEXT;
