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
  /** Empresa (slug do tenant) para desambiguar quando o e-mail existe em mais de
   *  uma organização. Opcional: com 1 só correspondência, o login dispensa. */
  tenantSlug?: string;
}

export interface LoginResponse {
  token: string;
  user: SessionUser;
}

// ── Control Plane / Super Admin (F1) ──

export const TENANT_STATUSES = ['ACTIVE', 'SUSPENDED', 'DELETED'] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export const PLANS = ['BASE', 'EVOLUCAO', 'ENTERPRISE', 'ADVISORY'] as const;
export type Plan = (typeof PLANS)[number];

/** Sessão de um Super Admin (control plane) — sem tenantId, escopo 'platform'. */
export interface PlatformAdmin {
  id: string;
  email: string;
  name: string;
}

export interface PlatformLoginResponse {
  token: string;
  admin: PlatformAdmin;
}

/** Resumo de uma empresa-cliente para o painel super-admin. */
export interface TenantSummary {
  id: string;
  organizationId: string;
  slug: string;
  name: string;
  plan: Plan;
  status: TenantStatus;
  createdAt: string;
}

export interface CreateTenantRequest {
  name: string;
  slug?: string; // derivado do nome quando ausente
  plan?: Plan;
  adminName: string;
  adminEmail: string;
  adminPassword?: string; // gerado quando ausente (retornado uma única vez)
}

/** Resultado do provisionamento de um novo tenant. */
export interface ProvisionResult {
  tenant: TenantSummary;
  adminEmail: string;
  /** Senha temporária do admin — só retornada quando gerada pelo sistema. */
  tempPassword?: string;
}

/** As 5 dimensões do ICD. */
export const ICD_DIMENSIONS = ['clareza', 'pressao', 'confianca', 'influencia', 'risco'] as const;
export type IcdDimension = (typeof ICD_DIMENSIONS)[number];

export const DOMINANT_PATTERNS = ['PRESSAO', 'AUTOIMAGEM', 'CONFORMIDADE', 'AMEACA', 'EQUILIBRADO'] as const;
export type DominantPattern = (typeof DOMINANT_PATTERNS)[number];

export interface IcdQuestion {
  id: number;
  dimension: IcdDimension;
  text: string;
  /** true = valor alto na escala indica MENOR coerência (será invertido no cálculo). */
  inverse: boolean;
}

/**
 * Catálogo oficial: 10 perguntas, 2 por dimensão, aplicadas a uma decisão real.
 * Escala Likert 1–5. pressao e risco são inversas (quanto maior, pior a coerência).
 */
export const ICD_QUESTIONS: IcdQuestion[] = [
  { id: 1, dimension: 'clareza', text: 'Eu tinha clareza sobre o objetivo ao tomar a decisão.', inverse: false },
  { id: 2, dimension: 'clareza', text: 'As informações disponíveis eram suficientes para decidir.', inverse: false },
  { id: 3, dimension: 'pressao', text: 'Senti pressão de tempo ou cobrança ao decidir.', inverse: true },
  { id: 4, dimension: 'pressao', text: 'A decisão foi tomada sob estresse ou urgência.', inverse: true },
  { id: 5, dimension: 'confianca', text: 'Eu confiava na minha capacidade de tomar essa decisão.', inverse: false },
  { id: 6, dimension: 'confianca', text: 'Assumi a responsabilidade pela decisão sem hesitar.', inverse: false },
  { id: 7, dimension: 'influencia', text: 'Dependi da aprovação de outros para decidir.', inverse: true },
  { id: 8, dimension: 'influencia', text: 'Evitei contrariar expectativas alheias ao decidir.', inverse: true },
  { id: 9, dimension: 'risco', text: 'Senti medo das consequências negativas da decisão.', inverse: true },
  { id: 10, dimension: 'risco', text: 'Decidi mais para evitar uma ameaça do que para buscar um ganho.', inverse: true },
];

export interface IcdAnswer {
  questionId: number;
  value: number; // 1–5
}

export type IcdDimensions = Record<IcdDimension, number>; // 0–100 (normalizado p/ coerência)

export interface IcdResult {
  score: number; // 0–100
  dimensions: IcdDimensions;
  dominantPattern: DominantPattern;
}

export interface SubmitIcdRequest {
  leaderId: string;
  cycleId?: string;
  answers: IcdAnswer[];
}
