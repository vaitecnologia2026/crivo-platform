-- Catálogo RBAC (dados) para os perfis e permissões novos — IDEMPOTENTE.
-- Substitui a necessidade de rodar o seed (destrutivo) em produção: insere as
-- permissões parecer:*, os papéis Consultor/Mentor/Academia e seus vínculos.
-- Espelha ROLE_PERMISSIONS de @crivo/types. ON CONFLICT torna seguro re-rodar.

-- 1) Permissões novas (parecer:view, parecer:manage).
INSERT INTO "permissions" ("id", "code", "module", "action", "label") VALUES
  (gen_random_uuid(), 'parecer:view',   'parecer', 'view',   'Ver parecer consultivo'),
  (gen_random_uuid(), 'parecer:manage', 'parecer', 'manage', 'Redigir/publicar parecer')
ON CONFLICT ("code") DO NOTHING;

-- 2) Papéis de sistema novos (Briefing §4).
INSERT INTO "role_defs" ("id", "code", "name", "isSystem") VALUES
  (gen_random_uuid(), 'CONSULTOR', 'Consultor CRIVO',  true),
  (gen_random_uuid(), 'MENTOR',    'Mentor',           true),
  (gen_random_uuid(), 'ACADEMIA',  'Usuário Academia', true)
ON CONFLICT ("code") DO NOTHING;

-- 3) Vínculos papel→permissão (espelha ROLE_PERMISSIONS).
INSERT INTO "role_permissions" ("roleId", "permId")
SELECT r."id", p."id"
FROM (VALUES
  -- parecer:view para papéis de gestão existentes
  ('ADMIN','parecer:view'), ('ADMIN','parecer:manage'),
  ('CEO','parecer:view'),   ('CEO','parecer:manage'),
  ('GESTOR','parecer:view'),
  ('RH','parecer:view'),    ('RH','parecer:manage'),
  ('JURIDICO','parecer:view'),
  -- Consultor CRIVO (autor do parecer)
  ('CONSULTOR','leads:view'), ('CONSULTOR','icd:view'), ('CONSULTOR','icd:submit'),
  ('CONSULTOR','users:view'), ('CONSULTOR','library:view'), ('CONSULTOR','library:manage'),
  ('CONSULTOR','parecer:view'), ('CONSULTOR','parecer:manage'),
  -- Mentor
  ('MENTOR','icd:view'), ('MENTOR','library:view'), ('MENTOR','library:manage'),
  -- Usuário Academia
  ('ACADEMIA','library:view')
) AS m("role_code", "perm_code")
JOIN "role_defs" r ON r."code" = m."role_code"
JOIN "permissions" p ON p."code" = m."perm_code"
ON CONFLICT DO NOTHING;
