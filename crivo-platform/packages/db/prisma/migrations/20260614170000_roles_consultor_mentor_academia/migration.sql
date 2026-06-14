-- Perfis CRIVO (Briefing §4): Consultor CRIVO, Mentor e Usuário Academia.
-- Adição aditiva e backward-compatible ao enum Role (ALTER TYPE ... ADD VALUE).
-- Os RoleDef/RolePermission correspondentes são populados pelo seed (RBAC dinâmico).
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CONSULTOR';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MENTOR';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ACADEMIA';
