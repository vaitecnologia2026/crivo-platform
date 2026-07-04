-- Base CRIVO (Tela 09): autorizações de uso por empresa (opt-in) — anonimizado,
-- benchmark, case, logo e depoimento. Default false (não usar sem autorização).
ALTER TABLE "tenants" ADD COLUMN "consentAnonymized" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tenants" ADD COLUMN "consentBenchmark" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tenants" ADD COLUMN "consentCase" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tenants" ADD COLUMN "consentLogo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tenants" ADD COLUMN "consentTestimonial" BOOLEAN NOT NULL DEFAULT false;
