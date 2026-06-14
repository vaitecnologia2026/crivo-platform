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
  { code: "library:view", module: "library", action: "view", label: "Ver biblioteca" },
  { code: "library:manage", module: "library", action: "manage", label: "Gerir biblioteca" },
] as const;
export type PermissionCode = (typeof PERMISSIONS)[number]["code"];

/** Papéis de sistema → permissões. Espelha o RBAC estático atual (compat). */
export const ROLE_PERMISSIONS: Record<Role, PermissionCode[]> = {
  ADMIN: ["leads:view", "leads:create", "leads:edit", "icd:view", "icd:submit", "branding:edit", "users:view", "users:create", "users:edit", "library:view", "library:manage"],
  CEO: ["leads:view", "leads:create", "leads:edit", "icd:view", "icd:submit", "branding:edit", "users:view", "users:create", "users:edit", "library:view", "library:manage"],
  GESTOR: ["leads:view", "leads:create", "leads:edit", "icd:view", "icd:submit", "users:view", "library:view"],
  RH: ["leads:view", "leads:create", "leads:edit", "icd:view", "icd:submit", "users:view", "users:create", "users:edit", "library:view", "library:manage"],
  LIDER: ["icd:view", "library:view"],
  JURIDICO: ["icd:view", "library:view"],
  COLABORADOR: ["library:view"],
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
  { code: 'biblioteca', name: 'Academia CRIVO', category: 'conteudo', minPlan: 'EVOLUCAO' },
  { code: 'relatorios', name: 'Relatórios & Evidências', category: 'analytics', minPlan: 'ENTERPRISE' },
  { code: 'campanhas', name: 'Campanhas de Diagnóstico', category: 'diagnostico', minPlan: 'ENTERPRISE' },
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

/** Resultado do setup de MFA — exibir o QR/segredo no app autenticador. */
export interface MfaSetupResponse {
  secret: string;
  otpauthUrl: string;
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

/** As 4 dimensões do ICD — os "4 Rs" da coerência decisória sob pressão. */
export const ICD_DIMENSIONS = ['reatividade', 'rigidez', 'repercussao', 'risco'] as const;
export type IcdDimension = (typeof ICD_DIMENSIONS)[number];

/** Tensão dominante = o "R" com maior tensão (menor coerência), ou EQUILIBRADO.
 *  Substitui o antigo "padrão dominante". Os valores espelham os 4 Rs. */
export const DOMINANT_PATTERNS = ['REATIVIDADE', 'RIGIDEZ', 'REPERCUSSAO', 'RISCO', 'EQUILIBRADO'] as const;
/** @deprecated nome legado; é a "tensão dominante". */
export type DominantPattern = (typeof DOMINANT_PATTERNS)[number];
export type DominantTension = DominantPattern;

export interface IcdQuestion {
  id: number;
  dimension: IcdDimension;
  text: string;
  /** true = valor alto na escala indica MAIOR tensão (menor coerência). */
  inverse: boolean;
}

/**
 * Catálogo oficial do ICD: 8 perguntas, 2 por dimensão (4 Rs), aplicadas a uma
 * decisão real e recente. Escala Likert 1–5. Todas inversas: quanto maior o
 * valor, maior a tensão (menor a coerência decisória). Não mede personalidade
 * nem saúde mental — lê a coerência da decisão sob pressão.
 */
export const ICD_QUESTIONS: IcdQuestion[] = [
  { id: 1, dimension: 'reatividade', text: 'Sob pressão, decidi no impulso antes de avaliar bem o cenário.', inverse: true },
  { id: 2, dimension: 'reatividade', text: 'Quando o clima esquentou, reagi na hora em vez de pausar.', inverse: true },
  { id: 3, dimension: 'rigidez', text: 'Tive dificuldade de rever a decisão mesmo diante de novos dados.', inverse: true },
  { id: 4, dimension: 'rigidez', text: 'Mantive minha posição mesmo quando a equipe trouxe outra leitura.', inverse: true },
  { id: 5, dimension: 'repercussao', text: 'Decidi pensando primeiro em como eu seria visto pelos outros.', inverse: true },
  { id: 6, dimension: 'repercussao', text: 'Evitei uma decisão necessária para não gerar repercussão negativa.', inverse: true },
  { id: 7, dimension: 'risco', text: 'Decidi mais para evitar uma ameaça do que para buscar um ganho.', inverse: true },
  { id: 8, dimension: 'risco', text: 'O medo das consequências pesou mais do que o mérito da decisão.', inverse: true },
];

export interface IcdAnswer {
  questionId: number;
  value: number; // 1–5
}

export type IcdDimensions = Record<IcdDimension, number>; // 0–100 (coerência por R; maior = melhor)

export interface IcdResult {
  score: number; // 0–100 (coerência geral)
  dimensions: IcdDimensions;
  /** Tensão dominante (4 Rs ou EQUILIBRADO). Campo mantém o nome legado. */
  dominantPattern: DominantTension;
}

export interface SubmitIcdRequest {
  leaderId: string;
  cycleId?: string;
  answers: IcdAnswer[];
}

// ── Diagnóstico Inicial (pré-diagnóstico público — porta de entrada / QR Code) ──
// É DISTINTO do ICD: lê a MATURIDADE organizacional em 5 dimensões (escala 1–5),
// não a coerência decisória de um líder. Não substitui o CRIVO Diagnóstico™.

export const PRE_DIAGNOSTIC_SCALE = [
  { value: 1, label: 'Muito baixo / inexistente' },
  { value: 2, label: 'Baixo' },
  { value: 3, label: 'Parcial' },
  { value: 4, label: 'Bom' },
  { value: 5, label: 'Muito bom / estruturado' },
] as const;

export const PRE_DIAGNOSTIC_DIMENSIONS = [
  'pressao_rotina',
  'lideranca_sustentacao',
  'cultura_comunicacao',
  'fatores_psicossociais',
  'governanca_plano',
] as const;
export type PreDiagnosticDimension = (typeof PRE_DIAGNOSTIC_DIMENSIONS)[number];

export const PRE_DIAGNOSTIC_DIMENSION_LABEL: Record<PreDiagnosticDimension, string> = {
  pressao_rotina: 'Pressão Organizacional e Rotina',
  lideranca_sustentacao: 'Liderança e Sustentação',
  cultura_comunicacao: 'Cultura, Comunicação e Segurança Psicológica',
  fatores_psicossociais: 'Fatores Psicossociais e NR-1',
  governanca_plano: 'Governança, Evidências e Plano de Ação',
};

export interface PreDiagnosticQuestion {
  id: number;
  dimension: PreDiagnosticDimension;
  text: string;
}

/** 10 perguntas (2 por dimensão), escala 1–5. Maior = mais maduro/estruturado. */
export const PRE_DIAGNOSTIC_QUESTIONS: PreDiagnosticQuestion[] = [
  { id: 1, dimension: 'pressao_rotina', text: 'A rotina da empresa permite que líderes e equipes atuem com clareza de prioridades, sem depender apenas de urgências e improvisos?' },
  { id: 2, dimension: 'pressao_rotina', text: 'A empresa consegue identificar quando pressão, sobrecarga ou mudanças constantes começam a afetar a execução, o clima e a qualidade das decisões?' },
  { id: 3, dimension: 'lideranca_sustentacao', text: 'Os líderes estão preparados para sustentar conversas difíceis, cobranças e decisões sem ampliar conflitos, ruídos ou insegurança?' },
  { id: 4, dimension: 'lideranca_sustentacao', text: 'A liderança possui rituais claros para acompanhar pessoas, prioridades, riscos e execução?' },
  { id: 5, dimension: 'cultura_comunicacao', text: 'As pessoas conseguem falar sobre problemas, riscos e dificuldades antes que eles se transformem em crise?' },
  { id: 6, dimension: 'cultura_comunicacao', text: 'A comunicação entre áreas favorece alinhamento, cooperação e tomada de decisão com clareza?' },
  { id: 7, dimension: 'fatores_psicossociais', text: 'A empresa já monitora sinais como afastamentos, turnover, conflitos, clima, queda de produtividade ou adoecimento relacionado ao trabalho?' },
  { id: 8, dimension: 'fatores_psicossociais', text: 'Existem ações estruturadas para identificar, registrar e tratar fatores psicossociais relacionados ao trabalho?' },
  { id: 9, dimension: 'governanca_plano', text: 'A empresa possui responsáveis, prazos, evidências e acompanhamento para tratar riscos humanos, culturais e organizacionais?' },
  { id: 10, dimension: 'governanca_plano', text: 'Os temas de liderança, cultura, riscos psicossociais e resultados são acompanhados de forma contínua pela gestão?' },
];

export const MATURITY_LEVELS = ['INICIAL', 'EM_ESTRUTURACAO', 'ESTRUTURADO', 'AVANCADO'] as const;
export type MaturityLevel = (typeof MATURITY_LEVELS)[number];

export const MATURITY_LABEL: Record<MaturityLevel, string> = {
  INICIAL: 'Inicial',
  EM_ESTRUTURACAO: 'Em estruturação',
  ESTRUTURADO: 'Estruturado',
  AVANCADO: 'Avançado',
};

export interface PreDiagnosticResult {
  score: number; // 0–100 (maturidade geral)
  level: MaturityLevel;
  byDimension: Record<PreDiagnosticDimension, number>; // 0–100 por dimensão
  topAttention: PreDiagnosticDimension; // dimensão de menor maturidade
}

/** Calcula o resultado do Diagnóstico Inicial. Pura — usável no front e no back. */
export function computePreDiagnostic(answers: IcdAnswer[]): PreDiagnosticResult {
  const byId = new Map(answers.map((a) => [a.questionId, a.value]));
  const raw: Record<PreDiagnosticDimension, number[]> = {
    pressao_rotina: [], lideranca_sustentacao: [], cultura_comunicacao: [],
    fatores_psicossociais: [], governanca_plano: [],
  };
  for (const q of PRE_DIAGNOSTIC_QUESTIONS) {
    const v = byId.get(q.id);
    if (v == null || !Number.isFinite(v) || v < 1 || v > 5) {
      throw new Error(`Resposta inválida ou ausente para a questão ${q.id}`);
    }
    raw[q.dimension].push(((v - 1) / 4) * 100);
  }
  const byDimension = {} as Record<PreDiagnosticDimension, number>;
  for (const d of PRE_DIAGNOSTIC_DIMENSIONS) {
    byDimension[d] = Math.round(raw[d].reduce((s, x) => s + x, 0) / raw[d].length);
  }
  const score = Math.round(
    PRE_DIAGNOSTIC_DIMENSIONS.reduce((s, d) => s + byDimension[d], 0) / PRE_DIAGNOSTIC_DIMENSIONS.length,
  );
  const topAttention = PRE_DIAGNOSTIC_DIMENSIONS.reduce((min, d) =>
    byDimension[d] < byDimension[min] ? d : min,
  );
  const level: MaturityLevel =
    score >= 80 ? 'AVANCADO' : score >= 60 ? 'ESTRUTURADO' : score >= 40 ? 'EM_ESTRUTURACAO' : 'INICIAL';
  return { score, level, byDimension, topAttention };
}

// ── Produtos (núcleo product-driven — Super Admin) ──
// Tudo nasce de um Produto: preço, limites, módulos, instrumento de diagnóstico
// (perguntas editáveis) e IA por produto. Espelha o model Product (control plane).

export const PRODUCT_STATUSES = ['DRAFT', 'ACTIVE', 'INACTIVE'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = {
  DRAFT: 'Rascunho',
  ACTIVE: 'Ativo',
  INACTIVE: 'Arquivado',
};

/** Config da IA dos líderes, por produto. */
export interface ProductAiConfig {
  prompt?: string;
  knowledgeBase?: string;
  rules?: string;
  limitations?: string;
  objective?: string;
  documents?: string[];
}

/** Instrumento de diagnóstico EDITÁVEL do produto (perguntas não-fixas). */
export interface ProductDiagnostic {
  dimensions?: { key: string; label: string }[];
  scales?: { key: string; label: string; options: { value: number; label: string }[] }[];
  blocks?: { key: string; label: string }[];
  questions?: {
    id: number;
    text: string;
    block?: string;
    dimension?: string;
    scale?: string;
    weight?: number;
    inverse?: boolean;
  }[];
}

export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: ProductStatus;
  plan: Plan | null;
  monthlyPriceCents: number;
  setupPriceCents: number;
  maxUsers: number;
  maxLeaders: number;
  companyType: string | null;
  modules: string[];
  isLeadCapture: boolean;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductDetail extends ProductSummary {
  diagnostic: ProductDiagnostic | null;
  aiConfig: ProductAiConfig | null;
}

export interface UpsertProductRequest {
  slug?: string;
  name: string;
  description?: string | null;
  status?: ProductStatus;
  plan?: Plan | null;
  monthlyPriceCents?: number;
  setupPriceCents?: number;
  maxUsers?: number;
  maxLeaders?: number;
  companyType?: string | null;
  modules?: string[];
  diagnostic?: ProductDiagnostic | null;
  aiConfig?: ProductAiConfig | null;
  isLeadCapture?: boolean;
}

// ── CRM do Super Admin (funil comercial da CRIVO) ──

export const PLATFORM_LEAD_STAGES = [
  'NOVO',
  'PRE_DIAGNOSTICO',
  'REUNIAO',
  'PROPOSTA',
  'FECHADO',
  'PERDIDO',
] as const;
export type PlatformLeadStage = (typeof PLATFORM_LEAD_STAGES)[number];

export const PLATFORM_LEAD_STAGE_LABEL: Record<PlatformLeadStage, string> = {
  NOVO: 'Novo lead',
  PRE_DIAGNOSTICO: 'Pré-diagnóstico',
  REUNIAO: 'Reunião agendada',
  PROPOSTA: 'Proposta',
  FECHADO: 'Fechado',
  PERDIDO: 'Perdido',
};

export interface PlatformLeadSummary {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  segment: string | null;
  employeesCount: string | null;
  origin: string | null;
  productId: string | null;
  diagnosticScore: number | null;
  diagnosticResult: PreDiagnosticResult | null;
  stage: PlatformLeadStage;
  notes: string | null;
  convertedTenantId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Payload público do Diagnóstico Inicial da LP (form + respostas). */
export interface CreateDiagnosticLeadRequest {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  segment?: string;
  employeesCount?: string;
  origin?: string;
  answers: IcdAnswer[];
}

export interface CreateDiagnosticLeadResponse {
  ok: true;
  result: PreDiagnosticResult;
}

// ── Contrato por empresa (Super Admin · Briefing §11 + Matriz) ──

export const DIAGNOSTIC_METHODS = ['INICIAL', 'ESSENCIAL', 'ORGANIZACIONAL'] as const;
export type DiagnosticMethod = (typeof DIAGNOSTIC_METHODS)[number];
export const DIAGNOSTIC_METHOD_LABEL: Record<DiagnosticMethod, string> = {
  INICIAL: 'Diagnóstico Inicial',
  ESSENCIAL: 'Diagnóstico Essencial',
  ORGANIZACIONAL: 'Diagnóstico Organizacional',
};

export const TECHNICAL_OUTPUTS = ['SEM_INTEGRACAO', 'AEP', 'AEP_PGR'] as const;
export type TechnicalOutput = (typeof TECHNICAL_OUTPUTS)[number];
export const TECHNICAL_OUTPUT_LABEL: Record<TechnicalOutput, string> = {
  SEM_INTEGRACAO: 'Sem integração formal',
  AEP: 'Apoio à AEP',
  AEP_PGR: 'Apoio à AEP + PGR',
};

export const CONTRACT_MODELS = ['PONTUAL', 'SEIS_MESES', 'DOZE_MESES', 'VINTE_QUATRO_MESES', 'CUSTOM'] as const;
export type ContractModel = (typeof CONTRACT_MODELS)[number];
export const CONTRACT_MODEL_LABEL: Record<ContractModel, string> = {
  PONTUAL: 'Pontual',
  SEIS_MESES: '6 meses',
  DOZE_MESES: '12 meses',
  VINTE_QUATRO_MESES: '24 meses',
  CUSTOM: 'Customizado',
};

export const CONTRACT_STATUSES = ['RASCUNHO', 'ATIVO', 'SUSPENSO', 'ENCERRADO'] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];
export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  RASCUNHO: 'Rascunho',
  ATIVO: 'Ativo',
  SUSPENSO: 'Suspenso',
  ENCERRADO: 'Encerrado',
};

export interface ContractData {
  id: string;
  organizationId: string;
  productId: string | null;
  model: ContractModel;
  status: ContractStatus;
  method: DiagnosticMethod | null;
  technicalOutput: TechnicalOutput;
  startDate: string | null;
  endDate: string | null;
  accessDays: number | null;
  rounds: number;
  maxRespondents: number;
  maxLeaders: number;
  optionalModules: string[];
  responsible: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertContractRequest {
  productId?: string | null;
  model?: ContractModel;
  status?: ContractStatus;
  method?: DiagnosticMethod | null;
  technicalOutput?: TechnicalOutput;
  startDate?: string | null;
  endDate?: string | null;
  accessDays?: number | null;
  rounds?: number;
  maxRespondents?: number;
  maxLeaders?: number;
  optionalModules?: string[];
  responsible?: string | null;
  notes?: string | null;
}

// ── Plano de Ação + Evidências (portal do cliente · Briefing §8/§9) ──

export const ACTION_STATUSES = [
  'SUGERIDA',
  'EM_REVISAO',
  'APROVADA',
  'EM_ANDAMENTO',
  'CONCLUIDA',
  'REAVALIADA',
] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];
export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = {
  SUGERIDA: 'Sugerida',
  EM_REVISAO: 'Em revisão',
  APROVADA: 'Aprovada',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDA: 'Concluída',
  REAVALIADA: 'Reavaliada',
};

export interface EvidenceData {
  id: string;
  itemId: string | null;
  kind: string;
  title: string;
  url: string | null;
  note: string | null;
  createdAt: string;
}

export interface ActionItemData {
  id: string;
  planId: string;
  point: string;
  origin: string | null;
  action: string;
  responsible: string | null;
  dueDate: string | null;
  status: ActionStatus;
  expectedEvidence: string | null;
  reviewDate: string | null;
  createdAt: string;
  evidences: EvidenceData[];
}

export interface ActionPlanData {
  id: string;
  title: string;
  source: string | null;
  validatedAt: string | null;
  validatedBy: string | null;
  createdAt: string;
  items: ActionItemData[];
}

export interface CreateActionPlanRequest {
  title: string;
  source?: string;
}
export interface CreateActionItemRequest {
  point: string;
  origin?: string;
  action: string;
  responsible?: string;
  dueDate?: string | null;
  expectedEvidence?: string;
}
export interface UpdateActionItemRequest {
  point?: string;
  origin?: string;
  action?: string;
  responsible?: string;
  dueDate?: string | null;
  status?: ActionStatus;
  expectedEvidence?: string;
  reviewDate?: string | null;
}
export interface CreateEvidenceRequest {
  kind: string;
  title: string;
  url?: string;
  note?: string;
}

// ── Configuração de IA (Super Admin · auditoria 2.3.1) ──

export const AI_MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1', 'o4-mini'] as const;
export type AiModel = (typeof AI_MODELS)[number];

export const AI_STATUS_LABEL: Record<string, string> = {
  ok: 'Conectada',
  invalid: 'Token inválido',
  rate_limited: 'Limite excedido',
  error: 'Erro',
  untested: 'Não testada',
};

/** Config de IA SEM o token em claro — nunca expomos a chave. */
export interface AiSettingsData {
  provider: string;
  model: string;
  enabled: boolean;
  enabledModules: string[];
  hasKey: boolean;
  keyHint: string | null; // últimos 4 chars, p/ exibir mascarado
  lastStatus: string | null;
  lastTestedAt: string | null;
}

export interface UpsertAiSettingsRequest {
  apiKey?: string; // novo token (texto puro); '' = limpar; undefined = manter
  model?: string;
  enabled?: boolean;
  enabledModules?: string[];
}

export interface AiTestRequest {
  apiKey?: string; // testa com token informado; ausente = usa o armazenado
}
export interface AiTestResult {
  ok: boolean;
  status: string; // ok | invalid | rate_limited | error
  message?: string;
}

// ── Documentos gerados (portal · Briefing §15 + Matriz "Documentos Gerados") ──

/** Frase de responsabilidade OBRIGATÓRIA em todos os documentos técnicos. */
export const RESPONSIBILITY_NOTE =
  'Os documentos gerados pela plataforma CRIVO têm caráter de apoio técnico, gerencial e documental à identificação, registro, gestão e acompanhamento dos fatores psicossociais relacionados ao trabalho. A revisão, validação, assinatura e integração formal desses documentos à AEP, ao GRO/PGR e às demais obrigações aplicáveis são de responsabilidade da empresa contratante e/ou do responsável técnico/designado.';

export const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  relatorio_preliminar: 'Relatório preliminar',
  dossie_aep: 'Dossiê de apoio à AEP',
  dossie_aep_pgr: 'Dossiê de apoio à AEP + PGR',
  inventario_pgr: 'Inventário / anexo para PGR',
  relatorio_tecnico: 'Relatório técnico',
  relatorio_executivo: 'Relatório executivo',
  plano_acao: 'Plano de Ação',
};

export interface DocumentDescriptor {
  type: string;
  title: string;
  available: boolean;
  reason?: string; // por que não está disponível (ex.: requer plano validado)
}

export interface DocumentSection {
  heading: string;
  body?: string;
  rows?: { label: string; value: string }[];
  /** Tabela com cabeçalho + linhas (ex.: plano de ação). */
  table?: { columns: string[]; data: string[][] };
}

export interface GeneratedDocument {
  type: string;
  title: string;
  subtitle?: string;
  company: string;
  generatedAt: string;
  meta: { label: string; value: string }[];
  sections: DocumentSection[];
  responsibilityNote: string;
}

// ── Diagnóstico Essencial (portal · Briefing §5) ──

export type EssentialRecordKind = 'ESCUTA' | 'OBSERVACAO';
export const ESSENTIAL_RECORD_LABEL: Record<EssentialRecordKind, string> = {
  ESCUTA: 'Registro de escuta e alinhamento',
  OBSERVACAO: 'Observação / análise da atividade',
};

export interface SelfAssessmentData {
  id: string;
  score: number;
  result: PreDiagnosticResult;
  createdAt: string;
}

export interface EssentialRecordData {
  id: string;
  kind: EssentialRecordKind;
  title: string;
  recordDate: string | null;
  participants: string | null;
  notes: string | null;
  points: string | null;
  createdAt: string;
}

export interface SubmitSelfAssessmentRequest {
  answers: IcdAnswer[];
}
export interface CreateEssentialRecordRequest {
  kind: EssentialRecordKind;
  title: string;
  recordDate?: string | null;
  participants?: string;
  notes?: string;
  points?: string;
}

// ── Biblioteca & Formação (conteúdo do tenant) ──

export const LIBRARY_KINDS = ['artigo', 'podcast', 'ebook', 'curso', 'framework'] as const;
export type LibraryKind = (typeof LIBRARY_KINDS)[number];

export interface LibraryItemData {
  id: string;
  title: string;
  description: string | null;
  kind: LibraryKind;
  url: string | null;
  createdAt: string;
}

export interface CreateLibraryItemRequest {
  title: string;
  description?: string;
  kind: LibraryKind;
  url?: string;
}

/** ICD pessoal do líder logado (Área do Líder), com posição no ranking. */
export interface MyIcd {
  score: number;
  dimensions: IcdDimensions;
  dominantPattern: DominantPattern;
  computedAt: string;
  rank: number; // 1 = melhor
  totalLideres: number;
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
