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

// ── RBAC dinâmico (F3) — catálogo de permissões módulo:ação ──
// Fonte única consumida pelo seed (popula o banco) e pela API (códigos).

export const PERMISSIONS = [
  { code: "leads:view", module: "leads", action: "view", label: "Ver leads" },
  { code: "leads:create", module: "leads", action: "create", label: "Criar leads" },
  { code: "leads:edit", module: "leads", action: "edit", label: "Editar leads" },
  { code: "icd:view", module: "icd", action: "view", label: "Ver indicadores ICD" },
  { code: "icd:submit", module: "icd", action: "submit", label: "Aplicar avaliação ICD" },
  { code: "branding:edit", module: "branding", action: "edit", label: "Editar identidade visual" },
  { code: "users:view", module: "users", action: "view", label: "Ver usuários" },
  { code: "users:create", module: "users", action: "create", label: "Criar usuários" },
  { code: "users:edit", module: "users", action: "edit", label: "Editar usuários" },
] as const;
export type PermissionCode = (typeof PERMISSIONS)[number]["code"];

/** Papéis de sistema → permissões. Espelha o RBAC estático atual (compat). */
export const ROLE_PERMISSIONS: Record<Role, PermissionCode[]> = {
  ADMIN: ["leads:view", "leads:create", "leads:edit", "icd:view", "icd:submit", "branding:edit", "users:view", "users:create", "users:edit"],
  CEO: ["leads:view", "leads:create", "leads:edit", "icd:view", "icd:submit", "branding:edit", "users:view", "users:create", "users:edit"],
  GESTOR: ["leads:view", "leads:create", "leads:edit", "icd:view", "icd:submit", "users:view"],
  RH: ["leads:view", "leads:create", "leads:edit", "icd:view", "icd:submit", "users:view", "users:create", "users:edit"],
  LIDER: ["icd:view"],
  JURIDICO: ["icd:view"],
  COLABORADOR: [],
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  CEO: "CEO",
  GESTOR: "Gestor",
  RH: "RH",
  LIDER: "Líder",
  JURIDICO: "Jurídico",
  COLABORADOR: "Colaborador",
};

// ── Gestão de usuários da empresa (time) ──

export interface UserSummary {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  role: Role;
  password?: string; // gerado quando ausente (retornado uma única vez)
}

export interface UpdateUserRequest {
  role?: Role;
  active?: boolean;
}

export interface CreateUserResult {
  user: UserSummary;
  /** Senha temporária — só quando gerada pelo sistema. */
  tempPassword?: string;
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

// ── Planos + módulos (F4) ──
// Fonte única de planos e do catálogo de módulos: o seed popula o banco e a API
// lê estes códigos. Mantém o enum Plan como hoje (sem tabela PlanDef nesta fatia).

/** Ordem crescente dos planos. Plano X "contém" todo módulo cujo minPlan ≤ X. */
export const PLAN_RANK: Record<Plan, number> = {
  BASE: 0,
  EVOLUCAO: 1,
  ENTERPRISE: 2,
  ADVISORY: 3,
};

export interface PlanLimits {
  /** null = ilimitado. */
  maxUsers: number | null;
  maxLeads: number | null;
}

/** Limites por plano (aplicados no metering — fatia 2 da F4). */
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  BASE: { maxUsers: 10, maxLeads: 200 },
  EVOLUCAO: { maxUsers: 50, maxLeads: 2_000 },
  ENTERPRISE: { maxUsers: null, maxLeads: null },
  ADVISORY: { maxUsers: null, maxLeads: null },
};

export const PLAN_LABELS: Record<Plan, string> = {
  BASE: 'Base',
  EVOLUCAO: 'Evolução',
  ENTERPRISE: 'Enterprise',
  ADVISORY: 'Advisory',
};

/** Catálogo GLOBAL de módulos da plataforma. minPlan = plano mínimo p/ habilitar.
 *  Espelha as telas da plataforma (alimenta a nav data-driven na F6). */
export const MODULES = [
  { code: 'dashboard', name: 'Dashboard', category: 'core', minPlan: 'BASE' },
  { code: 'icd', name: 'Indicadores ICD', category: 'core', minPlan: 'BASE' },
  { code: 'lider', name: 'Líderes', category: 'core', minPlan: 'BASE' },
  { code: 'crm', name: 'CRM / Pipeline', category: 'comercial', minPlan: 'EVOLUCAO' },
  { code: 'biblioteca', name: 'Biblioteca', category: 'conteudo', minPlan: 'EVOLUCAO' },
  { code: 'relatorios', name: 'Relatórios', category: 'analytics', minPlan: 'ENTERPRISE' },
  { code: 'campanhas', name: 'Campanhas', category: 'comercial', minPlan: 'ENTERPRISE' },
  { code: 'parecer', name: 'Parecer', category: 'advisory', minPlan: 'ADVISORY' },
] as const;
export type ModuleCode = (typeof MODULES)[number]['code'];

/** Códigos dos módulos liberados por um plano (minPlan ≤ plano). */
export function modulesForPlan(plan: Plan): ModuleCode[] {
  const rank = PLAN_RANK[plan];
  return MODULES.filter((m) => PLAN_RANK[m.minPlan as Plan] <= rank).map((m) => m.code);
}

/** true se o plano alcança o minPlan do módulo (pode habilitá-lo). */
export function planAllowsModule(plan: Plan, moduleCode: ModuleCode): boolean {
  const mod = MODULES.find((m) => m.code === moduleCode);
  if (!mod) return false;
  return PLAN_RANK[plan] >= PLAN_RANK[mod.minPlan as Plan];
}

/** White-label (F5): identidade visual de uma empresa. Campos null = usa o
 *  padrão CRIVO (tokens --crivo-*). primaryColor/accentColor são hex (#rrggbb). */
export interface TenantBrandingData {
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  emailFrom: string | null;
  whatsapp: string | null;
  footerText: string | null;
}

/** Atualização de branding (todos opcionais; ausente = não mexe). */
export type UpdateBrandingRequest = Partial<TenantBrandingData>;

/** Domínio próprio de uma empresa (F5). */
export interface TenantDomainData {
  id: string;
  domain: string;
  verified: boolean;
  primary: boolean;
}

/** Resolução PÚBLICA de um domínio → empresa (pré-login, p/ tema/white-label).
 *  Só expõe dados não-sensíveis. null quando o domínio não resolve. */
export interface PublicTenantResolution {
  slug: string;
  name: string;
  branding: TenantBrandingData;
}

/** Uso corrente de uma empresa vs. limites do plano (painel super-admin). */
export interface UsageSummary {
  plan: Plan;
  period: string; // YYYY-MM
  metrics: Array<{
    metric: string; // leads | api_calls | ...
    value: number;
    limit: number | null; // null = ilimitado
  }>;
}

/** Entrada do catálogo + se a empresa tem o módulo ativo (painel super-admin). */
export interface TenantModuleSummary {
  code: ModuleCode;
  name: string;
  category: string;
  minPlan: Plan;
  /** false quando o plano da empresa não alcança o minPlan. */
  availableForPlan: boolean;
  enabled: boolean;
}

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

/** Campanha de diagnóstico (ciclo de avaliação) com estatísticas agregadas. */
export interface CampaignSummary {
  id: string;
  name: string;
  status: 'OPEN' | 'CLOSED';
  createdAt: string;
  respondentes: number;
  totalParticipantes: number;
  adesao: number; // 0–100 (%)
  icdMedio: number | null;
}
