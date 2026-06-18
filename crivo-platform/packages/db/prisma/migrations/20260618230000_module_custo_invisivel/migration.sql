-- Módulo "Custo Invisível" (Briefing §12 — módulos opcionais). Catálogo global
-- de módulos. Inserção IDEMPOTENTE (ON CONFLICT) para atualizar prod sem seed.
INSERT INTO "module_catalog" ("id", "code", "name", "category", "minPlan")
VALUES (gen_random_uuid(), 'custo', 'Custo Invisível', 'analytics', 'ENTERPRISE')
ON CONFLICT ("code") DO NOTHING;
