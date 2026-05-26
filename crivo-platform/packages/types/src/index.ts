// Contratos compartilhados entre API e Web (DTOs, enums espelhados, sessão).

export const ROLES = [
  'COLABORADOR',
  'LIDER',
  'GESTOR',
  'RH',
  'JURIDICO',
  'CEO',
  'ADMIN',
] as const;
export type Role = (typeof ROLES)[number];

export interface SessionUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: Role;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: SessionUser;
}

/** As 5 dimensões do ICD (fase F1). */
export const ICD_DIMENSIONS = ['clareza', 'pressao', 'confianca', 'influencia', 'risco'] as const;
export type IcdDimension = (typeof ICD_DIMENSIONS)[number];
