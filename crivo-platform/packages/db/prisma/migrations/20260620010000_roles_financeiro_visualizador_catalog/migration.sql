-- Cargos Financeiro e Visualizador — passo 2/2: catálogo RBAC (dados).
-- IDEMPOTENTE (ON CONFLICT DO NOTHING). Espelha ROLE_PERMISSIONS de @crivo/types.
-- Substitui a necessidade do seed (destrutivo) em produção.

-- 1) Papéis de sistema no catálogo.
INSERT INTO "role_defs" ("id", "code", "name", "isSystem") VALUES
  (gen_random_uuid(), 'FINANCEIRO',   'Financeiro',   true),
  (gen_random_uuid(), 'VISUALIZADOR', 'Visualizador', true)
ON CONFLICT ("code") DO NOTHING;

-- 2) Vínculos papel→permissão (espelha ROLE_PERMISSIONS).
--    Financeiro: leitura de pipeline + biblioteca (sem módulo financeiro dedicado ainda).
--    Visualizador: somente leitura, transversal.
INSERT INTO "role_permissions" ("roleId", "permId")
SELECT r."id", p."id"
FROM (VALUES
  ('FINANCEIRO','leads:view'), ('FINANCEIRO','library:view'),
  ('VISUALIZADOR','leads:view'), ('VISUALIZADOR','icd:view'), ('VISUALIZADOR','users:view'),
  ('VISUALIZADOR','library:view'), ('VISUALIZADOR','parecer:view')
) AS m("role_code", "perm_code")
JOIN "role_defs" r ON r."code" = m."role_code"
JOIN "permissions" p ON p."code" = m."perm_code"
ON CONFLICT DO NOTHING;
