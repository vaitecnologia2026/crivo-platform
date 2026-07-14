// Contratos compartilhados entre API e Web (DTOs, enums espelhados, sessão).

export const ROLES = [
  'COLABORADOR',
  'LIDER',
  'GESTOR',
  'RH',
  'JURIDICO',
  'CEO',
  'ADMIN',
  // Perfis CRIVO (Briefing §4 — acompanhamento/conteúdo, não-empregados do tenant).
  'CONSULTOR', // Consultor CRIVO — acompanha o cliente, aplica diagnóstico e parecer.
  'MENTOR',    // Mentor — conduz mentorias e cura conteúdo da Academia.
  'ACADEMIA',  // Usuário Academia — acesso restrito à Academia CRIVO (conteúdo).
  'FINANCEIRO',   // Financeiro — leitura de pipeline/biblioteca (sem módulo financeiro dedicado ainda).
  'VISUALIZADOR', // Visualizador — somente leitura, transversal.
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
  { code: "parecer:view", module: "parecer", action: "view", label: "Ver parecer consultivo" },
  { code: "parecer:manage", module: "parecer", action: "manage", label: "Redigir/publicar parecer" },
] as const;
export type PermissionCode = (typeof PERMISSIONS)[number]["code"];

/** Papéis de sistema → permissões. Espelha o RBAC estático atual (compat). */
export const ROLE_PERMISSIONS: Record<Role, PermissionCode[]> = {
  ADMIN: ["leads:view", "leads:create", "leads:edit", "icd:view", "icd:submit", "branding:edit", "users:view", "users:create", "users:edit", "library:view", "library:manage", "parecer:view", "parecer:manage"],
  CEO: ["leads:view", "leads:create", "leads:edit", "icd:view", "icd:submit", "branding:edit", "users:view", "users:create", "users:edit", "library:view", "library:manage", "parecer:view", "parecer:manage"],
  GESTOR: ["leads:view", "leads:create", "leads:edit", "icd:view", "icd:submit", "users:view", "library:view", "parecer:view"],
  RH: ["leads:view", "leads:create", "leads:edit", "icd:view", "icd:submit", "users:view", "users:create", "users:edit", "library:view", "library:manage", "parecer:view", "parecer:manage"],
  LIDER: ["icd:view", "library:view"],
  JURIDICO: ["icd:view", "library:view", "parecer:view"],
  COLABORADOR: ["library:view"],
  // Consultor CRIVO: acompanha o cliente ponta a ponta (diagnóstico, conteúdo, parecer) — autor do parecer.
  CONSULTOR: ["leads:view", "icd:view", "icd:submit", "users:view", "library:view", "library:manage", "parecer:view", "parecer:manage"],
  // Mentor: conduz mentorias e cura a Academia; leitura dos indicadores do líder.
  MENTOR: ["icd:view", "library:view", "library:manage"],
  // Usuário Academia: acesso restrito ao conteúdo da Academia CRIVO.
  ACADEMIA: ["library:view"],
  // Financeiro: leitura de pipeline e biblioteca (sem módulo financeiro dedicado ainda).
  FINANCEIRO: ["leads:view", "library:view"],
  // Visualizador: somente leitura, transversal.
  VISUALIZADOR: ["leads:view", "icd:view", "users:view", "library:view", "parecer:view"],
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  CEO: "CEO",
  GESTOR: "Gestor",
  RH: "RH",
  LIDER: "Líder",
  JURIDICO: "Jurídico",
  COLABORADOR: "Colaborador",
  CONSULTOR: "Consultor CRIVO",
  MENTOR: "Mentor",
  ACADEMIA: "Usuário Academia",
  FINANCEIRO: "Financeiro",
  VISUALIZADOR: "Visualizador",
};

// ── Gestão de usuários da empresa (time) ──

export interface UserSummary {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  /** Telas (rotas) que o usuário pode acessar; null = sem restrição (papel/módulo decidem). */
  screenAccess: string[] | null;
  createdAt: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  role: Role;
  password?: string; // gerado quando ausente (retornado uma única vez)
  screenAccess?: string[] | null;
}

export interface UpdateUserRequest {
  role?: Role;
  active?: boolean;
  screenAccess?: string[] | null;
}

/** Uso de assentos (limite de usuários ativos) — limite vem do Produto da empresa. */
export interface UserSeats {
  active: number;
  max: number | null; // null = ilimitado
}

/** Dados cadastrais da empresa (autoatendimento na tela "Organização"). */
export interface OrganizationData {
  name: string;
  legalName: string | null;
  taxId: string | null;
  website: string | null;
  phone: string | null;
  plan: string;
}
export interface UpdateOrganizationRequest {
  name?: string;
  legalName?: string | null;
  taxId?: string | null;
  website?: string | null;
  phone?: string | null;
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
  { code: 'pocket', name: 'Pocket CRIVO', category: 'lideranca', minPlan: 'EVOLUCAO' },
  { code: 'mentorias', name: 'Mentorias', category: 'lideranca', minPlan: 'EVOLUCAO' },
  { code: 'crm', name: 'CRM / Pipeline', category: 'comercial', minPlan: 'EVOLUCAO' },
  { code: 'biblioteca', name: 'Academia CRIVO', category: 'conteudo', minPlan: 'EVOLUCAO' },
  { code: 'relatorios', name: 'Relatórios & Evidências', category: 'analytics', minPlan: 'ENTERPRISE' },
  { code: 'campanhas', name: 'Campanhas de Diagnóstico', category: 'diagnostico', minPlan: 'ENTERPRISE' },
  { code: 'analytics', name: 'People Analytics avançado', category: 'analytics', minPlan: 'ENTERPRISE' },
  { code: 'historico', name: 'Histórico & Auditoria', category: 'analytics', minPlan: 'ENTERPRISE' },
  { code: 'custo', name: 'Custo Invisível', category: 'analytics', minPlan: 'ENTERPRISE' },
  { code: 'parecer', name: 'Parecer', category: 'advisory', minPlan: 'ADVISORY' },
] as const;
export type ModuleCode = (typeof MODULES)[number]['code'];

/** Adicional do catálogo de upsells (tabela do cliente, mockup 14/07). */
export const ADDON_RECURRENCES = ['MENSAL', 'POR_CICLO', 'UNICO', 'POR_SESSAO'] as const;
export type AddonRecurrence = (typeof ADDON_RECURRENCES)[number];
export const ADDON_RECURRENCE_LABEL: Record<AddonRecurrence, string> = {
  MENSAL: 'Mensal',
  POR_CICLO: 'Por ciclo',
  UNICO: 'Único',
  POR_SESSAO: 'Por sessão',
};
export const ADDON_STATUSES = ['ATIVO', 'EM_REVISAO', 'AGUARDANDO_DADOS'] as const;
export type AddonStatus = (typeof ADDON_STATUSES)[number];
export const ADDON_STATUS_LABEL: Record<AddonStatus, string> = {
  ATIVO: 'Ativo',
  EM_REVISAO: 'Em revisão',
  AGUARDANDO_DADOS: 'Aguardando dados',
};
export interface AddonSummary {
  moduleCode: string;
  label: string;
  category: string; // taxonomia do cliente (ou a do MODULES como fallback)
  monthlyPriceCents: number;
  setupPriceCents: number;
  recurring: boolean;
  active: boolean;
  configured: boolean; // já tem preço/registro salvo
  description: string | null;
  recurrence: AddonRecurrence;
  priceLabel: string | null; // rótulo livre (ex.: "R$ 900 / dossiê")
  compatibleSolutions: string[];
  activatedModules: string[]; // códigos exibidos (mod-ia, mod-people…)
  limitsNote: string | null;
  dependenciesNote: string | null;
  releaseRule: string | null;
  statusEx: AddonStatus;
}
export interface AddonUpsertRequest {
  label?: string;
  monthlyPriceCents?: number;
  setupPriceCents?: number;
  recurring?: boolean;
  active?: boolean;
  description?: string | null;
  category?: string | null;
  recurrence?: AddonRecurrence;
  priceLabel?: string | null;
  compatibleSolutions?: string[];
  activatedModules?: string[];
  limitsNote?: string | null;
  dependenciesNote?: string | null;
  releaseRule?: string | null;
  statusEx?: AddonStatus;
}

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
  /** Token TXT a publicar em `_crivo.<domain>` para confirmar posse. */
  verificationToken: string | null;
  verifiedAt: string | null;
  lastVerifyAttempt: string | null;
  lastVerifyError: string | null;
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
  /** Grupo Empresarial (F1 · Caderno Tela 06). null = sem grupo. */
  groupId: string | null;
  /** Nome do grupo — presente quando a listagem o resolve; ausente em respostas pontuais. */
  groupName?: string | null;
  /** Cadastro do CNPJ (Caderno Tela 06 · Incluir). */
  cnpj: string | null;
  headquarterType: string | null; // MATRIZ | FILIAL
  internalResponsible: string | null;
  /** Autorizações de uso na Base CRIVO / prova social (Tela 09 · opt-in). */
  consentAnonymized: boolean;
  consentBenchmark: boolean;
  consentCase: boolean;
  consentLogo: boolean;
  consentTestimonial: boolean;
  createdAt: string;
}

/** Grupo Empresarial (F1): agrupa empresas-cliente (CNPJs) no control plane. */
export interface BusinessGroupSummary {
  id: string;
  name: string;
  createdAt: string;
  /** F3 — visão consolidada liberada no portal do cliente. */
  consolidatedEnabled: boolean;
  tenants: { id: string; name: string; slug: string; status: TenantStatus }[];
}

/** F3 — e-mail autorizado a ver o consolidado do grupo no portal do cliente. */
export interface GroupAccessEntry {
  id: string;
  email: string;
  createdAt: string;
}

/** Dashboard de Gestão CRIVO (Super Admin · Caderno Tela 01) — central operacional.
 *  Valores monetários em CENTAVOS. Métricas ainda não modeladas vêm em `naoModelado`. */
export interface DashboardData {
  periodDays: number;
  comercial: {
    leads: number;
    leadsPrev: number; // período anterior (para o delta ↑↓)
    propostas: number;
    fechadas: number;
    conversao: number; // 0-100
    faturamentoEstimadoCents: number; // estimado via preço do produto vendido
    ticketMedioCents: number;
    funnel: { key: string; label: string; count: number }[];
    porOrigem: { origem: string; count: number }[];
    porSolucao: { produto: string; count: number; receitaMensalCents: number }[];
    motivosPerda: { motivo: string; count: number }[]; // leads PERDIDO por motivo
    tempoRespostaMedioMin: number | null; // lead → 1º contato (min); null = sem dado
    leadsSemPrimeiroContato: number; // leads do período ainda sem 1º contato
    valorPropostoCents: number; // soma do valor proposto dos leads em aberto (pipeline)
    propostasEnviadas: number; // leads com proposta enviada no período
  };
  contratos: {
    ativos: number;
    mrrCents: number; // receita recorrente mensal (estimada, contratos ATIVO)
    arrCents: number;
    vencendo30: number;
    vencendo60: number;
    vencendo90: number;
    comAdicionais: number;
    porStatus: { status: string; count: number }[];
  };
  entregas: {
    diagnosticosAndamento: number; // ciclos abertos
    avaliacoes: number;
    planosPendentes: number; // planos não validados (minuta)
    acoesPendentes: number; // ações não concluídas
    evidencias: number;
    mentoriasAgendadas: number;
    mentoriasAtrasadas: number;
    clientesSemResponsavel: number;
    clientesSemAvanco: number; // clientes ativos sem nenhum diagnóstico iniciado
  };
  executivo: {
    clientesAtivos: number;
    clientesBloqueados: number;
    novosClientes: number; // no período
  };
  pendencias: {
    empresa: string;
    tipo: string;
    prazo: string | null; // ISO
    severidade: 'CRITICO' | 'ATENCAO' | 'OK';
  }[];
  /** Métricas do caderno ainda SEM suporte no schema (mostradas como "a modelar"). */
  naoModelado: string[];
}

/** F2 — linha por CNPJ na visão consolidada do grupo (só agregados; §11: nada individual). */
export interface GroupOverviewTenantRow {
  tenantId: string; // id do tenant (control plane)
  name: string;
  slug: string;
  status: TenantStatus;
  plan: Plan;
  activeUsers: number;
  assessments: number;
  /** Último ICD oficial da empresa (CompanyQuarterlyIcd). null = sem ciclo fechado OU suprimido (§11). */
  icdScore: number | null;
  icdSuppressed: boolean;
  actionsTotal: number;
  /** Encerradas = CONCLUIDA + REAVALIADA. */
  actionsDone: number;
  evidences: number;
  pocketDone: number;
  pocketTotal: number;
  campaignsOpen: number;
  campaignsTotal: number;
}

/** F2 — visão consolidada do Grupo Empresarial (Super Admin). */
export interface GroupOverview {
  group: { id: string; name: string; createdAt: string };
  tenants: GroupOverviewTenantRow[];
  consolidated: {
    tenants: number;
    activeUsers: number;
    assessments: number;
    /** Média dos ICDs oficiais disponíveis (ignora suprimidos/sem ciclo). */
    icdAverage: number | null;
    /** Nº de CNPJs com ICD oficial disponível (base da média). */
    icdCovered: number;
    actionsTotal: number;
    actionsDone: number;
    evidences: number;
    pocketDone: number;
    pocketTotal: number;
    campaignsOpen: number;
    campaignsTotal: number;
  };
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
  { id: 9, dimension: 'governanca_plano', text: 'A empresa possui responsáveis, prazos, evidências e acompanhamento para tratar riscos psicossociais, culturais e organizacionais?' },
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
  topAttention: PreDiagnosticDimension; // dimensão de menor maturidade (1ª em caso de empate; ver topAttentions)
  topAttentions?: PreDiagnosticDimension[]; // #4 — TODAS as dimensões empatadas na menor maturidade (não descarta empate)
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
  // #4 — empate: TODAS as dimensões com a menor maturidade entram como pontos de atenção (não só uma).
  const minDim = Math.min(...PRE_DIAGNOSTIC_DIMENSIONS.map((d) => byDimension[d]));
  const topAttentions = PRE_DIAGNOSTIC_DIMENSIONS.filter((d) => byDimension[d] === minDim);
  const topAttention = topAttentions[0];
  const level: MaturityLevel =
    score >= 80 ? 'AVANCADO' : score >= 60 ? 'ESTRUTURADO' : score >= 40 ? 'EM_ESTRUTURACAO' : 'INICIAL';
  return { score, level, byDimension, topAttention, topAttentions };
}

// ── Metodologia configurável (Fase 1C): scoring dirigido por config ──────────
// O motor passa a ler a metodologia ATIVA do banco (dimensões/perguntas/pesos/
// faixas). Mantém computePreDiagnostic (hardcode) como fallback. As perguntas da
// config são ORDENADAS: questionId = índice + 1 (mesmo contrato do fio com a LP).

export interface MethodologyConfigDimension {
  slug: string;
  label: string;
  weight: number;
}
export interface MethodologyConfigQuestion {
  dimensionSlug: string;
  text: string;
  weight: number;
  inverse: boolean;
}
export interface MethodologyConfigBand {
  code: string;
  label: string;
  min: number;
  max: number;
}
export interface MethodologyConfig {
  dimensions: MethodologyConfigDimension[];
  questions: MethodologyConfigQuestion[];
  bands: MethodologyConfigBand[];
}

export interface MethodologyScoreResult {
  score: number; // 0–100
  levelCode: string; // código da faixa (ex.: AVANCADO / BAIXO)
  levelLabel: string; // rótulo da faixa
  byDimension: { slug: string; label: string; value: number }[]; // 0–100 por dimensão
  topAttentions: string[]; // slugs das dimensões de menor valor (pontos de atenção)
}

/**
 * Pontua respostas usando uma metodologia configurável. Pura. Com a metodologia
 * v1 (seed = padrão CRIVO) produz EXATAMENTE o mesmo resultado de
 * computePreDiagnostic (provado em teste) — por isso ligar à v1 não muda nada.
 */
export function scoreWithMethodology(answers: IcdAnswer[], cfg: MethodologyConfig): MethodologyScoreResult {
  if (!cfg.dimensions.length || !cfg.questions.length || !cfg.bands.length) {
    throw new Error('Metodologia incompleta (faltam dimensões, perguntas ou faixas).');
  }
  const byId = new Map(answers.map((a) => [a.questionId, a.value]));
  const acc = new Map<string, { wsum: number; w: number }>();
  for (const d of cfg.dimensions) acc.set(d.slug, { wsum: 0, w: 0 });

  cfg.questions.forEach((q, i) => {
    const id = i + 1; // questionId = índice 1-based
    const v = byId.get(id);
    if (v == null || !Number.isFinite(v) || v < 1 || v > 5) {
      throw new Error(`Resposta inválida ou ausente para a questão ${id}`);
    }
    let norm = ((v - 1) / 4) * 100;
    if (q.inverse) norm = 100 - norm;
    const a = acc.get(q.dimensionSlug);
    if (a) {
      const w = q.weight ?? 1;
      a.wsum += norm * w;
      a.w += w;
    }
  });

  const byDimension = cfg.dimensions.map((d) => {
    const a = acc.get(d.slug)!;
    return { slug: d.slug, label: d.label, value: a.w > 0 ? Math.round(a.wsum / a.w) : 0 };
  });

  let wsum = 0;
  let w = 0;
  for (const d of cfg.dimensions) {
    const val = byDimension.find((x) => x.slug === d.slug)!.value;
    const dw = d.weight ?? 1;
    wsum += val * dw;
    w += dw;
  }
  const score = w > 0 ? Math.round(wsum / w) : 0;

  const band = cfg.bands.find((b) => score >= b.min && score <= b.max) ?? cfg.bands[cfg.bands.length - 1];
  const minVal = Math.min(...byDimension.map((d) => d.value));
  const topAttentions = byDimension.filter((d) => d.value === minVal).map((d) => d.slug);

  return { score, levelCode: band?.code ?? '', levelLabel: band?.label ?? '', byDimension, topAttentions };
}

// ── Questionário Psicossocial Organizacional (Briefing §6 — diagnóstico AMPLO) ──
// Instrumento por COLABORADOR (anônimo, agregado por setor), DISTINTO do ICD
// (líder/coerência decisória) e do Pré-Diagnóstico (autoavaliação de maturidade).
// Lê a percepção de fatores psicossociais reconhecidos (referência: ISO 45003 /
// contexto NR-1). 6 dimensões × 2 afirmações, escala Likert 1–5. Afirmações
// POSITIVAS (proteção): maior valor = MENOR risco psicossocial. v1 — revisável
// com o cliente (nº de dimensões, redação e itens podem ser calibrados).
export const PSYCHOSOCIAL_DIMENSIONS = [
  'demandas',
  'controle',
  'apoio',
  'reconhecimento',
  'clareza',
  'relacoes',
] as const;
export type PsychosocialDimension = (typeof PSYCHOSOCIAL_DIMENSIONS)[number];

export const PSYCHOSOCIAL_DIMENSION_LABEL: Record<PsychosocialDimension, string> = {
  demandas: 'Demandas e ritmo de trabalho',
  controle: 'Autonomia e participação',
  apoio: 'Apoio (liderança e colegas)',
  reconhecimento: 'Reconhecimento e desenvolvimento',
  clareza: 'Clareza de papel e justiça',
  relacoes: 'Relações e segurança psicológica',
};

export interface PsychosocialQuestion {
  id: number;
  dimension: PsychosocialDimension;
  text: string;
}

/** 12 perguntas (2 por dimensão), escala 1–5. Afirmações positivas: maior = mais protetor (menor risco). */
export const PSYCHOSOCIAL_QUESTIONS: PsychosocialQuestion[] = [
  { id: 1, dimension: 'demandas', text: 'Consigo realizar meu trabalho sem sobrecarga frequente.' },
  { id: 2, dimension: 'demandas', text: 'O volume e o ritmo de trabalho são sustentáveis no dia a dia.' },
  { id: 3, dimension: 'controle', text: 'Tenho autonomia para organizar como faço minhas tarefas.' },
  { id: 4, dimension: 'controle', text: 'Minha opinião é considerada em decisões que afetam meu trabalho.' },
  { id: 5, dimension: 'apoio', text: 'Recebo apoio da minha liderança quando preciso.' },
  { id: 6, dimension: 'apoio', text: 'Posso contar com meus colegas diante de dificuldades.' },
  { id: 7, dimension: 'reconhecimento', text: 'Meu trabalho é reconhecido de forma justa.' },
  { id: 8, dimension: 'reconhecimento', text: 'Vejo perspectivas de desenvolvimento e crescimento na empresa.' },
  { id: 9, dimension: 'clareza', text: 'Sei com clareza o que se espera do meu papel.' },
  { id: 10, dimension: 'clareza', text: 'As regras e decisões da empresa são aplicadas de forma justa.' },
  { id: 11, dimension: 'relacoes', text: 'Sinto-me seguro(a) para falar de problemas sem medo de retaliação.' },
  { id: 12, dimension: 'relacoes', text: 'O ambiente é livre de assédio e desrespeito.' },
];

export const PSYCHOSOCIAL_RISK_LEVELS = ['BAIXO', 'MODERADO', 'ALTO', 'CRITICO'] as const;
export type PsychosocialRiskLevel = (typeof PSYCHOSOCIAL_RISK_LEVELS)[number];

export const PSYCHOSOCIAL_RISK_LABEL: Record<PsychosocialRiskLevel, string> = {
  BAIXO: 'Risco baixo',
  MODERADO: 'Risco moderado',
  ALTO: 'Risco alto',
  CRITICO: 'Risco crítico',
};

export interface PsychosocialResult {
  score: number; // 0–100 (proteção geral; MAIOR = melhor / menor risco)
  level: PsychosocialRiskLevel;
  byDimension: Record<PsychosocialDimension, number>; // 0–100 por dimensão
  topRisk: PsychosocialDimension; // dimensão de menor proteção (maior risco)
}

/** Nível de risco a partir do score de proteção (0–100). Maior proteção = menor risco. */
export function psychosocialLevel(score: number): PsychosocialRiskLevel {
  return score >= 75 ? 'BAIXO' : score >= 55 ? 'MODERADO' : score >= 35 ? 'ALTO' : 'CRITICO';
}

/** Calcula o resultado do questionário psicossocial. Pura — usável no front e no back. */
export function computePsychosocial(answers: IcdAnswer[]): PsychosocialResult {
  const byId = new Map(answers.map((a) => [a.questionId, a.value]));
  const raw = {
    demandas: [], controle: [], apoio: [], reconhecimento: [], clareza: [], relacoes: [],
  } as Record<PsychosocialDimension, number[]>;
  for (const q of PSYCHOSOCIAL_QUESTIONS) {
    const v = byId.get(q.id);
    if (v == null || !Number.isFinite(v) || v < 1 || v > 5) {
      throw new Error(`Resposta inválida ou ausente para a questão ${q.id}`);
    }
    raw[q.dimension].push(((v - 1) / 4) * 100);
  }
  const byDimension = {} as Record<PsychosocialDimension, number>;
  for (const d of PSYCHOSOCIAL_DIMENSIONS) {
    byDimension[d] = Math.round(raw[d].reduce((s, x) => s + x, 0) / raw[d].length);
  }
  const score = Math.round(
    PSYCHOSOCIAL_DIMENSIONS.reduce((s, d) => s + byDimension[d], 0) / PSYCHOSOCIAL_DIMENSIONS.length,
  );
  const topRisk = PSYCHOSOCIAL_DIMENSIONS.reduce((min, d) =>
    byDimension[d] < byDimension[min] ? d : min,
  );
  return { score, level: psychosocialLevel(score), byDimension, topRisk };
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
  category: string | null; // subtítulo/categoria do card (vitrine)
  coreDelivery: string | null; // "Core da entrega"
  implementation: string | null; // implantação (ex.: "Imediata")
  priceLabel: string | null; // rótulo livre de preço
  modalities: string[];
  suggestedAddons: string[];
  compatiblePackages: string[];
  modules: string[];
  coreModules: string[]; // módulos incluídos por padrão (CORE)
  isLeadCapture: boolean;
  // Enquadramento comercial (Tela 03 — Incluir).
  appearsOnLp: boolean;
  sellableStandalone: boolean;
  canBeAddon: boolean;
  allowsAi: boolean;
  allowsCustomAi: boolean;
  allowedAddons: string[]; // adicionais permitidos (moduleCode)
  method: DiagnosticMethod | null; // Tipo de diagnóstico: Inicial / Essencial / Organizacional
  supportedOutputs: TechnicalOutput[]; // Saídas técnicas suportadas: Subsídio AEP / AEP+GRO-PGR / Sem integração
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
  category?: string | null;
  coreDelivery?: string | null;
  implementation?: string | null;
  priceLabel?: string | null;
  modalities?: string[];
  suggestedAddons?: string[];
  compatiblePackages?: string[];
  modules?: string[];
  coreModules?: string[];
  diagnostic?: ProductDiagnostic | null;
  aiConfig?: ProductAiConfig | null;
  isLeadCapture?: boolean;
  appearsOnLp?: boolean;
  sellableStandalone?: boolean;
  canBeAddon?: boolean;
  allowsAi?: boolean;
  allowsCustomAi?: boolean;
  allowedAddons?: string[];
  method?: DiagnosticMethod | null;
  supportedOutputs?: TechnicalOutput[];
}

// ── CRM do Super Admin (funil comercial da CRIVO) ──

export const PLATFORM_LEAD_STAGES = [
  'NOVO',
  'PRE_DIAGNOSTICO',
  'REUNIAO',
  'OPORTUNIDADE',
  'PROPOSTA',
  'NEGOCIACAO',
  'FECHADO',
  'CONTRATO',
  'ONBOARDING',
  'IMPLANTACAO',
  'ENTREGA',
  'SUSTENTACAO',
  'RENOVACAO',
  'UPSELL',
  'PERDIDO',
] as const;
export type PlatformLeadStage = (typeof PLATFORM_LEAD_STAGES)[number];

export const PLATFORM_LEAD_STAGE_LABEL: Record<PlatformLeadStage, string> = {
  NOVO: 'Captação',
  PRE_DIAGNOSTICO: 'Pré-diagnóstico',
  REUNIAO: 'Reunião',
  OPORTUNIDADE: 'Qualificação',
  PROPOSTA: 'Proposta',
  NEGOCIACAO: 'Negociação',
  FECHADO: 'Fechamento',
  CONTRATO: 'Contrato rascunho',
  ONBOARDING: 'Onboarding',
  IMPLANTACAO: 'Implantação',
  ENTREGA: 'Entrega',
  SUSTENTACAO: 'Sustentação',
  RENOVACAO: 'Renovação',
  UPSELL: 'Upsell',
  PERDIDO: 'Perdido',
};

/** Dados cadastrais capturados na consulta de CNPJ (BrasilAPI) — guardados no lead. */
export interface LeadCnpjData {
  cnpj: string;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  situacao: string | null;
  cnaeCodigo: number | null;
  cnaePrincipal: string | null;
  cnaesSecundarios: { codigo: string; descricao: string | null }[];
  porte: string | null;
  naturezaJuridica: string | null;
  capitalSocial: number | null;
  cidade: string | null;
  uf: string | null;
  bairro: string | null;
  logradouro: string | null;
  numero: string | null;
  cep: string | null;
  telefone: string | null;
  email: string | null;
  socios: { nome?: string; qualificacao?: string }[];
}

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
  cnpj: string | null;
  riskGrade: string | null; // BAIXO | MEDIO | ALTO (preliminar — base do CNPJ)
  razaoSocial: string | null; // razão social da consulta CNPJ (BrasilAPI)
  cnpjData: LeadCnpjData | null; // todos os dados cadastrais capturados pelo CNPJ
  diagnosticScore: number | null;
  diagnosticResult: PreDiagnosticResult | null;
  stage: PlatformLeadStage;
  notes: string | null;
  lostReason: string | null; // motivo de perda (só quando stage === 'PERDIDO')
  firstContactedAt: string | null; // ISO — 1º contato registrado (tempo de resposta)
  interestProductId: string | null; // solução de interesse (pré-venda; ≠ produto de origem)
  nextActionAt: string | null; // ISO — data da próxima ação (follow-up)
  nextActionNote: string | null; // o que fazer na próxima ação (follow-up)
  commercialOwner: string | null; // responsável comercial (CRIVO) pelo lead
  proposedValueCents: number | null; // valor proposto (centavos)
  proposalSentAt: string | null; // ISO — quando a proposta foi enviada
  potentialAddons: string[]; // adicionais/módulos potenciais (pré-venda)
  convertedTenantId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Canais/origem do lead (Caderno Tela 02 [2]) — usados no CRM e no dashboard.
 *  `origin` continua string livre no banco; estes são os valores canônicos do seletor. */
export const PLATFORM_LEAD_ORIGINS = [
  { value: 'ITZ', label: 'ITZ' },
  { value: 'EVENTO', label: 'Evento' },
  { value: 'LANDING_PAGE', label: 'Landing Page' },
  { value: 'INDICACAO', label: 'Indicação' },
  { value: 'PARCEIRO', label: 'Parceiro' },
  { value: 'ANUNCIO', label: 'Anúncio' },
  { value: 'OUTRO', label: 'Outro' },
] as const;
export type PlatformLeadOrigin = (typeof PLATFORM_LEAD_ORIGINS)[number]['value'];

/** Rótulo amigável de uma origem — cobre os canônicos + os valores legados de intake. */
export function platformLeadOriginLabel(origin: string | null | undefined): string {
  if (!origin) return '(não informada)';
  const canon = PLATFORM_LEAD_ORIGINS.find((o) => o.value === origin);
  if (canon) return canon.label;
  const legacy: Record<string, string> = {
    'lp-diagnostico': 'Landing Page (Diagnóstico)',
    lp: 'Landing Page',
    'dashboard-cnpj': 'Consulta CNPJ',
    qrcode: 'QR Code',
    indicacao: 'Indicação',
    anuncio: 'Anúncio',
    parceiro: 'Parceiro',
    evento: 'Evento',
    itz: 'ITZ',
  };
  return legacy[origin] ?? origin;
}

/** Motivos de perda estruturados (Caderno) — usados no CRM e no dashboard. */
export const PLATFORM_LEAD_LOST_REASONS = [
  { value: 'PRECO', label: 'Preço' },
  { value: 'SEM_RETORNO', label: 'Sem retorno' },
  { value: 'SEM_ORCAMENTO', label: 'Sem orçamento' },
  { value: 'CONCORRENCIA', label: 'Concorrência' },
  { value: 'SEM_INTERESSE', label: 'Sem interesse' },
  { value: 'OUTRO', label: 'Outro' },
] as const;
export type PlatformLeadLostReason = (typeof PLATFORM_LEAD_LOST_REASONS)[number]['value'];
export const PLATFORM_LEAD_LOST_REASON_LABEL: Record<PlatformLeadLostReason, string> = {
  PRECO: 'Preço',
  SEM_RETORNO: 'Sem retorno',
  SEM_ORCAMENTO: 'Sem orçamento',
  CONCORRENCIA: 'Concorrência',
  SEM_INTERESSE: 'Sem interesse',
  OUTRO: 'Outro',
};

/** Payload público do Diagnóstico Inicial da LP (form + respostas). */
export interface CreateDiagnosticLeadRequest {
  name: string;
  cnpj?: string;
  role?: string;
  company?: string;
  email?: string;
  phone?: string;
  segment?: string;
  employeesCount?: string;
  challenges?: string[];
  challengeOther?: string;
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
  organizationId: string | null; // null = contrato de grupo
  groupId: string | null; // preenchido em contrato de grupo (Tela 05 [5])
  productId: string | null;
  solutionIds: string[]; // soluções contratadas (Tela 05: várias por contrato)
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
  solutionIds?: string[];
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
  /** Metadados do arquivo enviado (quando a evidência é um upload, não um link).
   *  Os bytes não trafegam aqui — baixados sob demanda em /evidences/:id/file. */
  fileName: string | null;
  fileMime: string | null;
  fileSize: number | null;
  createdAt: string;
}

/** Classificação de risco do fator psicossocial (inventário/PGR §6/§15). */
export const INVENTORY_RISK_LEVELS = ['BAIXO', 'MEDIO', 'ALTO', 'CRITICO'] as const;
export type InventoryRiskLevel = (typeof INVENTORY_RISK_LEVELS)[number];
export const INVENTORY_RISK_LABEL: Record<InventoryRiskLevel, string> = {
  BAIXO: 'Baixo',
  MEDIO: 'Médio',
  ALTO: 'Alto',
  CRITICO: 'Crítico',
};

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
  /** Inventário §6/§15: grupos expostos + classificação de risco do fator. */
  exposedGroup: string | null;
  riskLevel: string | null;
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
  exposedGroup?: string;
  riskLevel?: string;
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
  exposedGroup?: string;
  riskLevel?: string;
}
export interface CreateEvidenceRequest {
  kind: string;
  title: string;
  url?: string;
  note?: string;
}

// ── Sugestão automática de ações (Briefing §8) ──
// A partir da tensão dominante (4 Rs) do diagnóstico, sugere ações do catálogo
// (ActionTemplate) das categorias afins. Heurística por categoria — fallback no
// catálogo completo. Respeita a supressão §14 (sem leitura agregada < 5 líderes).

/** Tensão dominante (4 Rs) → categorias de ActionTemplate mais relevantes. */
export const TENSION_TO_TEMPLATE_CATEGORIES: Record<DominantPattern, string[]> = {
  REATIVIDADE: ['Pessoas', 'Cultura'],
  RIGIDEZ: ['Cultura', 'Operação'],
  REPERCUSSAO: ['Cultura', 'Cliente'],
  RISCO: ['Operação', 'Compliance'],
  EQUILIBRADO: [],
};

export interface SuggestedActionTemplate {
  id: string;
  title: string;
  category: string;
  description: string | null;
  suggestedResponsible: string | null;
  expectedEvidence: string | null;
  defaultReviewDays: number;
}

export interface SuggestedActionsData {
  /** Tensão dominante identificada (null = sem leitura agregada suficiente). */
  tension: DominantPattern | null;
  reason: string;
  templates: SuggestedActionTemplate[];
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
  relatorio_evolucao: 'Relatório de evolução',
  plano_acao: 'Plano de Ação',
  parecer_consultivo: 'Parecer Consultivo CRIVO',
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

// ── Parecer Consultivo CRIVO (portal · Briefing §6 — módulo de autoria do consultor) ──
// A camada HUMANA do diagnóstico: o consultor consolida os indicadores e redige
// sinais, hipóteses, prioridades e recomendações. Sem IA e sem causalidade
// absoluta. Vira documento (PDF) só após publicação. Data plane (RLS por tenant).

export const PARECER_STATUSES = ['RASCUNHO', 'PUBLICADO'] as const;
export type ParecerStatus = (typeof PARECER_STATUSES)[number];
export const PARECER_STATUS_LABEL: Record<ParecerStatus, string> = {
  RASCUNHO: 'Rascunho',
  PUBLICADO: 'Publicado',
};

export interface ParecerData {
  id: string;
  title: string;
  status: ParecerStatus;
  context: string | null;         // contexto/leitura da empresa
  signals: string | null;         // sinais observados nos indicadores
  hypotheses: string | null;      // hipóteses de trabalho
  priorities: string | null;      // prioridades
  recommendations: string | null; // recomendações
  author: string | null;          // consultor responsável
  devolutivaAt: string | null;    // devolutiva agendada
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertParecerRequest {
  title?: string;
  context?: string | null;
  signals?: string | null;
  hypotheses?: string | null;
  priorities?: string | null;
  recommendations?: string | null;
  devolutivaAt?: string | null;
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

// ── Aceite de termos/LGPD no 1º acesso (Briefing · Matriz §Confidencialidade) ──

/** Versão vigente dos termos/LGPD. Bump → todos reaceitam. */
export const TERMS_VERSION = '2026-06';

export interface TermsStatus {
  accepted: boolean;
  acceptedVersion: string | null;
  currentVersion: string;
}

// ── Biblioteca & Formação (conteúdo do tenant) ──

export const LIBRARY_KINDS = [
  'curso', 'trilha', 'video', 'youtube', 'linkedin', 'podcast',
  'artigo', 'ebook', 'pdf', 'guia', 'checklist', 'mentoria', 'framework',
] as const;
export type LibraryKind = (typeof LIBRARY_KINDS)[number];
export const LIBRARY_KIND_LABEL: Record<LibraryKind, string> = {
  curso: 'Curso',
  trilha: 'Trilha',
  video: 'Vídeo',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  podcast: 'Podcast',
  artigo: 'Artigo',
  ebook: 'E-book',
  pdf: 'PDF',
  guia: 'Guia',
  checklist: 'Checklist',
  mentoria: 'Gravação de mentoria',
  framework: 'Framework',
};

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

export interface UpdateLibraryItemRequest {
  title?: string;
  description?: string;
  kind?: LibraryKind;
  url?: string;
}

/**
 * ICD pessoal do líder logado (Área do Líder).
 *
 * § PRIVACIDADE — Anexo Técnico ICD do Líder v1, §11: o líder NÃO deve visualizar
 * ranking individual nem percentil de posição entre pares. Mostramos apenas o
 * score próprio, dimensões, tensão dominante e timestamp.
 */
export interface MyIcd {
  score: number;
  dimensions: IcdDimensions;
  dominantPattern: DominantPattern;
  computedAt: string;
}

// =====================================================================
// REGISTRO DE DECISÃO — Anexo Técnico ICD do Líder v1, §5–§9.
// Base operacional do ICD: o líder registra decisões reais; o ICD avalia
// a coerência da decisão em 4 eixos (Clareza/Critério/Alinhamento/Sustentação).
// Os enums abaixo cobrem os campos visíveis ao líder (§5.1) e a regra
// de impacto/peso (§9.3).
// =====================================================================

/** Impacto da decisão — define peso na média ponderada trimestral (Anexo §9.3). */
export const DECISION_IMPACTS = ['BAIXO', 'MEDIO', 'ALTO'] as const;
export type DecisionImpact = (typeof DECISION_IMPACTS)[number];

/** Peso da decisão no ICD oficial (Anexo §9.3): BAIXO fica só no histórico. */
export const DECISION_IMPACT_WEIGHT: Record<DecisionImpact, number> = {
  BAIXO: 0,
  MEDIO: 1,
  ALTO: 2,
};

export const DECISION_IMPACT_LABEL: Record<DecisionImpact, string> = {
  BAIXO: 'Baixo (apenas histórico)',
  MEDIO: 'Médio (peso 1 no ICD)',
  ALTO: 'Alto (peso 2 no ICD)',
};

/** Natureza da decisão (Anexo §5.1). */
export const DECISION_TYPES = [
  'INDIVIDUAL',
  'COLETIVA',
  'RECOMENDACAO_APROVACAO',
  'COMPARTILHADA',
] as const;
export type DecisionType = (typeof DECISION_TYPES)[number];

export const DECISION_TYPE_LABEL: Record<DecisionType, string> = {
  INDIVIDUAL: 'Individual',
  COLETIVA: 'Coletiva (em grupo)',
  RECOMENDACAO_APROVACAO: 'Recomendação que dependeu de aprovação',
  COMPARTILHADA: 'Compartilhada (com superior/par)',
};

/** Correlação com o Pocket CRIVO (Anexo §5.1). */
export const DECISION_POCKET_USES = ['NAO_UTILIZADO', 'ANTES', 'DURANTE'] as const;
export type DecisionPocketUse = (typeof DECISION_POCKET_USES)[number];

export const DECISION_POCKET_USE_LABEL: Record<DecisionPocketUse, string> = {
  NAO_UTILIZADO: 'Não utilizei',
  ANTES: 'Sim, antes da decisão',
  DURANTE: 'Sim, durante a decisão',
};

/** Fator de pressão dominante (Anexo §5.1). */
export const DECISION_PRESSURE_FACTORS = [
  'URGENCIA',
  'CONFLITO',
  'FALTA_INFORMACAO',
  'PRESSAO_RESULTADO',
  'RISCO_FINANCEIRO',
  'RISCO_PESSOAS',
  'RISCO_JURIDICO',
  'EXPOSICAO_REPUTACIONAL',
  'OUTRO',
] as const;
export type DecisionPressureFactor = (typeof DECISION_PRESSURE_FACTORS)[number];

export const DECISION_PRESSURE_FACTOR_LABEL: Record<DecisionPressureFactor, string> = {
  URGENCIA: 'Urgência',
  CONFLITO: 'Conflito interno',
  FALTA_INFORMACAO: 'Falta de informação',
  PRESSAO_RESULTADO: 'Pressão por resultado',
  RISCO_FINANCEIRO: 'Risco financeiro',
  RISCO_PESSOAS: 'Risco a pessoas',
  RISCO_JURIDICO: 'Risco jurídico',
  EXPOSICAO_REPUTACIONAL: 'Exposição reputacional',
  OUTRO: 'Outro',
};

/** Janela para revisão futura da decisão (Anexo §5.1). */
export const DECISION_REVISION_PERIODS = ['D30', 'D60', 'D90', 'SEM_REVISAO'] as const;
export type DecisionRevisionPeriod = (typeof DECISION_REVISION_PERIODS)[number];

export const DECISION_REVISION_PERIOD_LABEL: Record<DecisionRevisionPeriod, string> = {
  D30: 'Em 30 dias',
  D60: 'Em 60 dias',
  D90: 'Em 90 dias',
  SEM_REVISAO: 'Sem revisão prevista',
};

/** Ciclo de vida da decisão (Anexo §5.3). Elegibilidade ao oficial = impact ≠ BAIXO. */
export const DECISION_STATUSES = ['EM_REGISTRO', 'REGISTRADA', 'AVALIADA_PELO_ICD'] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

/** Categorias padrão criadas por-tenant na primeira inicialização (Anexo §5.1).
 *  Podem ser renomeadas/desativadas; isDefault marca as seed para distinguir
 *  das criadas manualmente pelo cliente. */
export const DEFAULT_DECISION_CATEGORIES: Array<{ slug: string; name: string }> = [
  { slug: 'pessoas', name: 'Pessoas' },
  { slug: 'operacao', name: 'Operação' },
  { slug: 'cliente', name: 'Cliente' },
  { slug: 'estrategia', name: 'Estratégia' },
  { slug: 'financeiro', name: 'Financeiro' },
  { slug: 'cultura', name: 'Cultura' },
  { slug: 'processo', name: 'Processo' },
  { slug: 'risco-compliance', name: 'Risco / Compliance' },
  { slug: 'outro', name: 'Outro' },
];

/** Públicos potencialmente afetados padrão (Anexo §5.1) — M:N com Decision. */
export const DEFAULT_AFFECTED_AUDIENCES: Array<{ slug: string; name: string }> = [
  { slug: 'equipe', name: 'Equipe' },
  { slug: 'cliente', name: 'Cliente' },
  { slug: 'fornecedor', name: 'Fornecedor' },
  { slug: 'diretoria', name: 'Diretoria' },
  { slug: 'pares', name: 'Pares' },
  { slug: 'sociedade', name: 'Sociedade' },
];

/** Categoria de decisão (por-tenant, editável). */
export interface DecisionCategory {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  active: boolean;
  order: number;
}

/** Público potencialmente afetado (por-tenant). */
export interface AffectedAudience {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  order: number;
}

/** Ação de sustentação prevista (Anexo §5.1). 1:1 com Decisão. */
export interface SustentationActionData {
  id: string;
  action: string;
  responsible: string;
  deadline: string;
  expectedResult: string | null;
  evidenceUrl: string | null;
}

/** Registro de decisão real (Anexo §5.1). */
export interface DecisionData {
  id: string;
  leaderId: string;
  title: string;
  description: string;
  category: DecisionCategory | null;
  impact: DecisionImpact;
  type: DecisionType;
  pocketUse: DecisionPocketUse;
  pressureFactor: DecisionPressureFactor;
  revisionPeriod: DecisionRevisionPeriod;
  status: DecisionStatus;
  decidedAt: string;
  audiences: AffectedAudience[];
  sustentationAction: SustentationActionData | null;
  createdAt: string;
  updatedAt: string;
}

/** Payload de criação/edição de decisão (front → API). */
export interface DecisionInput {
  title: string;
  description: string;
  categoryId: string | null;
  impact: DecisionImpact;
  type: DecisionType;
  pocketUse: DecisionPocketUse;
  pressureFactor: DecisionPressureFactor;
  revisionPeriod: DecisionRevisionPeriod;
  decidedAt: string;
  audienceIds: string[];
  sustentationAction?: {
    action: string;
    responsible: string;
    deadline: string;
    expectedResult?: string;
    evidenceUrl?: string;
  };
}

// =====================================================================
// ICD NOVO — 4 Eixos (Anexo Técnico ICD do Líder v1, §6–§9).
// Substitui o modelo legado dos 4 Rs. As 8 afirmações P1–P8 (§7) são
// aplicadas SOBRE uma decisão real registrada. Escala 1–5 → score
// (valor − 1) × 25. Cada eixo é a média das 2 perguntas. ICD da decisão
// é a média dos 4 eixos.
// =====================================================================

/** Os 4 eixos oficiais do ICD (Anexo §6). */
export const ICD_AXES = ['CLAREZA', 'CRITERIO', 'ALINHAMENTO', 'SUSTENTACAO'] as const;
export type IcdAxis = (typeof ICD_AXES)[number];

export const ICD_AXIS_LABEL: Record<IcdAxis, string> = {
  CLAREZA: 'Clareza Decisória',
  CRITERIO: 'Critério Decisório',
  ALINHAMENTO: 'Alinhamento Decisório',
  SUSTENTACAO: 'Sustentação Decisória',
};

export const ICD_AXIS_DESCRIPTION: Record<IcdAxis, string> = {
  CLAREZA:
    'Se a decisão foi construída com base em fatos, dados, informações relevantes e consciência das lacunas existentes.',
  CRITERIO:
    'Se a decisão foi conduzida com discernimento, prioridade e consistência, mesmo sob pressão.',
  ALINHAMENTO:
    'Se a decisão considerou pessoas, áreas, processos, comunicação e condições reais de implementação.',
  SUSTENTACAO:
    'Se a decisão é estratégica, executável, coerente com cultura e valores, e sustentável em seus impactos futuros.',
};

/** Afirmação oficial do ICD aplicada à decisão registrada (Anexo §7).
 *  Regra de redação §7: SEMPRE em formato de afirmação (sem ponto de
 *  interrogação) — o líder responde uma escala de concordância. */
export interface IcdAxisQuestion {
  /** Código oficial: "P1" .. "P8". */
  id: string;
  axis: IcdAxis;
  /** Texto da afirmação (sem `?`, conforme §7). */
  text: string;
}

/** Catálogo oficial das 8 afirmações P1–P8 do ICD (Anexo §7). */
export const ICD_AXIS_QUESTIONS: IcdAxisQuestion[] = [
  {
    id: 'P1',
    axis: 'CLAREZA',
    text: 'Os fatos, dados e informações relevantes foram identificados antes da conclusão da decisão.',
  },
  {
    id: 'P2',
    axis: 'CLAREZA',
    text: 'As principais premissas, dúvidas ou lacunas de informação foram reconhecidas antes da conclusão da decisão.',
  },
  {
    id: 'P3',
    axis: 'CRITERIO',
    text: 'Mesmo sob pressão, os elementos essenciais foram analisados antes da escolha.',
  },
  {
    id: 'P4',
    axis: 'CRITERIO',
    text: 'A decisão foi orientada por critérios e prioridades claros, mesmo diante de urgências ou imprevistos.',
  },
  {
    id: 'P5',
    axis: 'ALINHAMENTO',
    text: 'As pessoas, áreas ou processos impactados foram considerados de forma adequada.',
  },
  {
    id: 'P6',
    axis: 'ALINHAMENTO',
    text: 'Diferenças de prioridades ou perspectivas foram tratadas para favorecer a implementação da decisão.',
  },
  {
    id: 'P7',
    axis: 'SUSTENTACAO',
    text: 'Consequências de médio e longo prazo foram avaliadas antes da escolha final.',
  },
  {
    id: 'P8',
    axis: 'SUSTENTACAO',
    text: 'A decisão é coerente com a estratégia, a cultura e os valores que se deseja sustentar.',
  },
];

/** Escala de concordância oficial (Anexo §8). value: 1–5 → score: 0–100. */
export const ICD_AXIS_SCALE = [
  { value: 1, label: 'Discordo totalmente', score: 0 },
  { value: 2, label: 'Discordo parcialmente', score: 25 },
  { value: 3, label: 'Nem concordo nem discordo', score: 50 },
  { value: 4, label: 'Concordo parcialmente', score: 75 },
  { value: 5, label: 'Concordo totalmente', score: 100 },
] as const;

/** Fórmula técnica oficial (Anexo §8): score = (value − 1) × 25. */
export function icdAxisValueToScore(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error(`Resposta inválida: ${value}. Use 1–5.`);
  }
  return (value - 1) * 25;
}

/** Resposta ao ICD da decisão. */
export interface IcdAxisAnswer {
  /** "P1" .. "P8". */
  id: string;
  /** 1–5. */
  value: number;
}

/** Scores por eixo (0–100). */
export type IcdAxesScores = Record<IcdAxis, number>;

/** Resultado completo do ICD de uma decisão (Anexo §9). */
export interface DecisionIcdResult {
  /** ICD da decisão (0–100) — média dos 4 eixos (§9.2). */
  score: number;
  /** Scores por eixo (§9.1). */
  axes: IcdAxesScores;
  /** Respostas brutas (8 afirmações). */
  answers: IcdAxisAnswer[];
  /** Peso da decisão no ICD oficial (§9.3): derivado do impact. */
  weight: number;
}

/** Calcula o ICD de uma decisão (Anexo §9.1 e §9.2). Função pura, sem I/O.
 *  Lança se faltar resposta ou se IDs forem inválidos. */
export function computeDecisionIcd(
  answers: IcdAxisAnswer[],
  impact: DecisionImpact,
): DecisionIcdResult {
  // Valida: deve ter as 8 afirmações P1-P8, sem duplicatas.
  const expected = new Set(ICD_AXIS_QUESTIONS.map((q) => q.id));
  const given = new Set(answers.map((a) => a.id));
  if (given.size !== 8) {
    throw new Error(`São necessárias 8 respostas (P1–P8). Recebidas: ${given.size}.`);
  }
  for (const id of expected) {
    if (!given.has(id)) throw new Error(`Resposta de ${id} ausente.`);
  }

  // Converte cada valor (1-5) em score (0-100), indexado por P*.
  const scoresById = new Map<string, number>();
  for (const a of answers) {
    scoresById.set(a.id, icdAxisValueToScore(a.value));
  }

  // Média por eixo (§9.1): cada eixo tem 2 afirmações.
  const axes: IcdAxesScores = {
    CLAREZA: 0,
    CRITERIO: 0,
    ALINHAMENTO: 0,
    SUSTENTACAO: 0,
  };
  for (const axis of ICD_AXES) {
    const qs = ICD_AXIS_QUESTIONS.filter((q) => q.axis === axis);
    const sum = qs.reduce((acc, q) => acc + (scoresById.get(q.id) ?? 0), 0);
    axes[axis] = Math.round(sum / qs.length);
  }

  // ICD da decisão (§9.2): média dos 4 eixos.
  const score = Math.round(
    (axes.CLAREZA + axes.CRITERIO + axes.ALINHAMENTO + axes.SUSTENTACAO) / 4,
  );

  return { score, axes, answers, weight: DECISION_IMPACT_WEIGHT[impact] };
}

/** Payload do front para submeter o ICD da decisão. */
export interface SubmitDecisionIcdRequest {
  answers: IcdAxisAnswer[];
}

/** Resposta da API com o ICD persistido de uma decisão. */
export interface DecisionIcdData {
  id: string;
  decisionId: string;
  leaderId: string;
  score: number;
  axes: IcdAxesScores;
  answers: IcdAxisAnswer[];
  weight: number;
  computedAt: string;
}

// =====================================================================
// CICLO TRIMESTRAL DO ICD — Anexo Técnico ICD do Líder v1, §9.4–§9.6,
// §10 (faixas de maturidade), §11 (privacidade/supressão).
// =====================================================================

/** Faixas de Maturidade Decisória (Anexo §10). Ordem: pior → melhor. */
export const ICD_MATURITY_BANDS = [
  { key: 'CRITICA', min: 0, max: 49, label: 'Maturidade Decisória Crítica' },
  { key: 'DESENVOLVIMENTO', min: 50, max: 64, label: 'Maturidade Decisória em Desenvolvimento' },
  { key: 'FUNCIONAL', min: 65, max: 74, label: 'Maturidade Decisória Funcional' },
  { key: 'CONSISTENTE', min: 75, max: 84, label: 'Maturidade Decisória Consistente' },
  { key: 'AVANCADA', min: 85, max: 94, label: 'Maturidade Decisória Avançada' },
  { key: 'ELEVADA', min: 95, max: 100, label: 'Maturidade Decisória Elevada — validar consistência' },
] as const;

export type IcdMaturityBand = (typeof ICD_MATURITY_BANDS)[number]['key'];

/** Mapeia um score 0–100 na faixa de maturidade correspondente (Anexo §10). */
export function getIcdMaturityBand(score: number): typeof ICD_MATURITY_BANDS[number] {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const band = ICD_MATURITY_BANDS.find((b) => clamped >= b.min && clamped <= b.max);
  // Garantido pela cobertura 0..100 do array; defensivamente devolve a primeira.
  return band ?? ICD_MATURITY_BANDS[0];
}

/** Anexo §11 — recortes (área/cargo/unidade) só são exibidos com volume mínimo.
 *  Abaixo desse número, o sistema oculta o recorte ou agrega em grupo maior. */
export const MIN_LEADERS_FOR_DISCLOSURE = 5;

/** Aplica a regra de supressão a um conjunto de scores (Anexo §11): se o
 *  número de líderes for menor que `MIN_LEADERS_FOR_DISCLOSURE`, devolve
 *  `{ suppressed: true, score: null }`. */
export function applyIcdSuppression(leaderScores: number[]): {
  suppressed: boolean;
  score: number | null;
  count: number;
} {
  const count = leaderScores.length;
  if (count < MIN_LEADERS_FOR_DISCLOSURE) {
    return { suppressed: true, score: null, count };
  }
  const score = Math.round(leaderScores.reduce((sum, s) => sum + s, 0) / count);
  return { suppressed: false, score, count };
}

/** Anexo §9.4 — calcula o ICD trimestral ponderado de UM líder.
 *  Inclui apenas as avaliações com peso > 0 (impact MÉDIO/ALTO).
 *  Fórmula: Σ(score × peso) / Σ(pesos). Devolve null se não houver elegível. */
export function computeLeaderQuarterlyIcd(scores: Array<{ score: number; weight: number; axes?: IcdAxesScores }>): {
  score: number;
  decisionCount: number;
  totalWeight: number;
  axesAverage: IcdAxesScores;
} | null {
  const eligible = scores.filter((s) => s.weight > 0);
  if (eligible.length === 0) return null;

  const totalWeight = eligible.reduce((sum, s) => sum + s.weight, 0);
  const score = Math.round(
    eligible.reduce((sum, s) => sum + s.score * s.weight, 0) / totalWeight,
  );

  // Média ponderada por eixo (mesma fórmula §9.1+§9.4 aplicada por dimensão).
  const axes: IcdAxesScores = { CLAREZA: 0, CRITERIO: 0, ALINHAMENTO: 0, SUSTENTACAO: 0 };
  for (const axis of ICD_AXES) {
    const weighted = eligible.reduce(
      (sum, s) => sum + ((s.axes?.[axis] ?? 0) * s.weight),
      0,
    );
    axes[axis] = Math.round(weighted / totalWeight);
  }

  return {
    score,
    decisionCount: eligible.length,
    totalWeight,
    axesAverage: axes,
  };
}

/** Anexo §9.5 — ICD oficial da empresa = média dos ICDs trimestrais dos
 *  líderes elegíveis. Aplica supressão <5 (§11). Devolve distribuição por
 *  faixa de maturidade (Anexo §10) e média por eixo (se não suprimido). */
export function computeCompanyQuarterlyIcd(
  leaderScores: Array<{ score: number; axesAverage: IcdAxesScores }>,
): {
  score: number | null;
  suppressed: boolean;
  eligibleLeaders: number;
  distribution: Record<IcdMaturityBand, number>;
  axesAverage: IcdAxesScores;
} {
  const suppression = applyIcdSuppression(leaderScores.map((l) => l.score));

  // Confidencialidade §11: sob supressão (<5 líderes), NÃO expor a distribuição
  // por faixa nem as médias por eixo — com 1–4 líderes o histograma é, na prática,
  // dado individual. Tudo zerado; só `eligibleLeaders` (contagem) e `suppressed`.
  const distribution: Record<IcdMaturityBand, number> = {
    CRITICA: 0,
    DESENVOLVIMENTO: 0,
    FUNCIONAL: 0,
    CONSISTENTE: 0,
    AVANCADA: 0,
    ELEVADA: 0,
  };
  const axesAverage: IcdAxesScores = { CLAREZA: 0, CRITERIO: 0, ALINHAMENTO: 0, SUSTENTACAO: 0 };
  if (!suppression.suppressed && leaderScores.length > 0) {
    for (const l of leaderScores) {
      distribution[getIcdMaturityBand(l.score).key] += 1;
    }
    for (const axis of ICD_AXES) {
      const sum = leaderScores.reduce((acc, l) => acc + (l.axesAverage[axis] ?? 0), 0);
      axesAverage[axis] = Math.round(sum / leaderScores.length);
    }
  }

  return {
    score: suppression.score,
    suppressed: suppression.suppressed,
    eligibleLeaders: leaderScores.length,
    distribution,
    axesAverage,
  };
}

/** Ciclo trimestral do ICD (§9.6). */
export interface IcdCycleData {
  id: string;
  name: string;
  quarter: number; // 1..4
  year: number;
  startsAt: string;
  endsAt: string;
  status: 'OPEN' | 'CLOSED';
  closedAt: string | null;
}

/** ICD trimestral ponderado do líder (§9.4). */
export interface LeaderQuarterlyIcdData {
  id: string;
  cycleId: string;
  leaderId: string;
  score: number;
  decisionCount: number;
  totalWeight: number;
  axesAverage: IcdAxesScores;
  band: typeof ICD_MATURITY_BANDS[number];
  computedAt: string;
}

/** ICD oficial da empresa no ciclo (§9.5). Sob supressão <5 (§11). */
export interface CompanyQuarterlyIcdData {
  id: string;
  cycleId: string;
  score: number | null;
  suppressed: boolean;
  eligibleLeaders: number;
  distribution: Record<IcdMaturityBand, number>;
  axesAverage: IcdAxesScores;
  band: typeof ICD_MATURITY_BANDS[number] | null; // null se suprimido
  computedAt: string;
}

/** Payload de criação de novo ciclo trimestral (POST /icd-cycles). */
export interface CreateIcdCycleRequest {
  quarter: number; // 1..4
  year: number;
  startsAt: string;
  endsAt: string;
  name?: string;
}

/** Calcula label padrão do ciclo: "2026-Q3". */
export function defaultIcdCycleName(year: number, quarter: number): string {
  return `${year}-Q${quarter}`;
}

// =====================================================================
// POCKET CRIVO / INTERNAL ENGINE (Anexo Técnico Pocket v1).
// 10 perguntas reflexivas (C1-O2) nas 5 dimensões CRIVO. NÃO gera score.
// Prepara o líder ANTES ou DURANTE decisões relevantes (§5).
// =====================================================================

/** As 5 dimensões da base CRIVO (Anexo Pocket §4.1). */
export const POCKET_DIMENSIONS = ['C', 'R', 'I', 'V', 'O'] as const;
export type PocketDimension = (typeof POCKET_DIMENSIONS)[number];

export const POCKET_DIMENSION_LABEL: Record<PocketDimension, string> = {
  C: 'Consciência',
  R: 'Responsabilidade',
  I: 'Integração',
  V: 'Valores',
  O: 'Organização',
};

export const POCKET_DIMENSION_FUNCTION: Record<PocketDimension, string> = {
  C: 'Observar fatos, contexto e estado interno antes de reagir.',
  R: 'Distinguir o que está sob influência do líder e qual resposta pode ser assumida.',
  I: 'Considerar informações, impactos e perspectivas relevantes.',
  V: 'Conectar a decisão ou resposta à cultura, referência e princípios desejados.',
  O: 'Transformar clareza em próximo passo, ação e acompanhamento.',
};

/** Pergunta reflexiva oficial do Pocket (Anexo §6). */
export interface PocketQuestion {
  /** Código oficial: "C1" .. "O2". */
  code: string;
  dimension: PocketDimension;
  /** Texto da pergunta (mantém ponto de interrogação — §6: pergunta reflexiva). */
  text: string;
}

/** Catálogo OFICIAL das 10 perguntas do Pocket (Anexo §6). */
export const POCKET_QUESTIONS: PocketQuestion[] = [
  {
    code: 'C1',
    dimension: 'C',
    text: 'O que parece estar influenciando mais esta decisão agora: os fatos, o contexto ou meu estado interno?',
  },
  {
    code: 'C2',
    dimension: 'C',
    text: 'Se a pressão fosse menor, eu avaliaria esta situação da mesma forma?',
  },
  {
    code: 'R1',
    dimension: 'R',
    text: 'Estou conduzindo a situação ou sendo conduzido por ela?',
  },
  {
    code: 'R2',
    dimension: 'R',
    text: 'O que está realmente sob minha influência neste momento?',
  },
  {
    code: 'I1',
    dimension: 'I',
    text: 'Que informação relevante ainda precisa ser considerada?',
  },
  {
    code: 'I2',
    dimension: 'I',
    text: 'Estou avaliando apenas o resultado imediato ou também seus impactos?',
  },
  {
    code: 'V1',
    dimension: 'V',
    text: 'Esta decisão reforça a cultura que desejo construir?',
  },
  {
    code: 'V2',
    dimension: 'V',
    text: 'Eu gostaria que esta forma de decidir virasse referência para a equipe?',
  },
  {
    code: 'O1',
    dimension: 'O',
    text: 'O próximo passo está claro ou apenas parece urgente?',
  },
  {
    code: 'O2',
    dimension: 'O',
    text: 'Esta decisão simplifica ou complica a execução futura?',
  },
];

/** Versão oficial do conjunto de perguntas (Anexo §12). Bumpar quando o
 *  catálogo for revisado para manter rastro histórico nas sessões antigas. */
export const POCKET_QUESTIONS_VERSION = 'v1';

/** Momento de uso (Anexo §8). */
export const POCKET_MOMENTS = ['AVULSO', 'ANTES_DECISAO', 'DURANTE_DECISAO'] as const;
export type PocketMomentOfUse = (typeof POCKET_MOMENTS)[number];

export const POCKET_MOMENT_LABEL: Record<PocketMomentOfUse, string> = {
  AVULSO: 'Reflexão avulsa',
  ANTES_DECISAO: 'Antes de uma decisão',
  DURANTE_DECISAO: 'Durante uma decisão',
};

export const POCKET_SESSION_STATUSES = ['EM_ANDAMENTO', 'CONCLUIDA'] as const;
export type PocketSessionStatus = (typeof POCKET_SESSION_STATUSES)[number];

/** Reflexão a uma das 10 perguntas (Anexo §7). */
export interface PocketReflectionData {
  id: string;
  questionCode: string;
  text: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/** Sessão Pocket (Anexo §5/§12). */
export interface PocketSessionData {
  id: string;
  leaderId: string;
  context: string | null;
  momentOfUse: PocketMomentOfUse;
  decisionId: string | null;
  status: PocketSessionStatus;
  questionsVersion: string;
  reflections: PocketReflectionData[];
  aiSummary: PocketAiSummaryData | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Síntese opcional da Mentoria IA (Anexo §7/§10). */
export interface PocketAiSummaryData {
  id: string;
  synthesis: string;
  recommendation: string | null;
  nextStep: string | null;
  modelVersion: string;
  createdAt: string;
}

/** Payload de criação de sessão Pocket. */
export interface CreatePocketSessionRequest {
  context?: string;
  momentOfUse?: PocketMomentOfUse;
  decisionId?: string;
}

/** Payload de submissão de uma reflexão (POST /pocket/sessions/:id/reflections). */
export interface UpsertPocketReflectionRequest {
  questionCode: string;
  text?: string;
  tags?: string[];
}

// ── Área do Líder — Trilha de desenvolvimento + Copiloto CRIVO (Briefing §6/§7) ──
// A trilha é DERIVADA do ICD do líder: a tensão dominante (4 Rs) define o foco e
// as práticas. Não é personalidade nem saúde mental — é coerência decisória sob
// pressão. O Copiloto é um apoio reflexivo (IA), não um diagnóstico.

export interface LeaderTrack {
  /** Tensão dominante a que a trilha responde. */
  tension: DominantPattern;
  title: string;
  focus: string;
  /** Práticas concretas para desenvolver a coerência naquela tensão. */
  practices: string[];
}

/** Mapa tensão dominante (4 Rs) → trilha de desenvolvimento do líder. */
export const LEADER_TRACKS: Record<DominantPattern, LeaderTrack> = {
  REATIVIDADE: {
    tension: 'REATIVIDADE',
    title: 'Decidir sob pressão sem reagir no impulso',
    focus: 'Criar um intervalo entre o estímulo e a decisão para reduzir reações automáticas.',
    practices: [
      'Antes de decisões quentes, nomeie a emoção e respire 3 vezes antes de responder.',
      'Adote a regra das “24h” para decisões reversíveis de alto impacto emocional.',
      'Registre 1 decisão por semana: o que pressionava, o que decidi, o que faria diferente.',
    ],
  },
  RIGIDEZ: {
    tension: 'RIGIDEZ',
    title: 'Rever decisões diante de novos dados',
    focus: 'Sustentar firmeza sem fechar para evidências e leituras divergentes da equipe.',
    practices: [
      'Em cada decisão, pergunte: “qual dado me faria mudar de ideia?”.',
      'Convide ativamente uma visão contrária antes de fechar a posição.',
      'Revise mensalmente uma decisão mantida e avalie se ainda se sustenta.',
    ],
  },
  REPERCUSSAO: {
    tension: 'REPERCUSSAO',
    title: 'Decidir pelo mérito, não pela imagem',
    focus: 'Separar a decisão necessária do receio de como ela será percebida.',
    practices: [
      'Explicite o critério técnico/de negócio antes de pensar na repercussão.',
      'Identifique a decisão que você adia por medo de reação e dê o primeiro passo.',
      'Comunique o “porquê” da decisão — clareza reduz ruído de percepção.',
    ],
  },
  RISCO: {
    tension: 'RISCO',
    title: 'Equilibrar proteção e oportunidade',
    focus: 'Decidir buscando ganho legítimo, não apenas evitando ameaças.',
    practices: [
      'Para cada decisão defensiva, descreva também o ganho que ela pode destravar.',
      'Dimensione o risco real (probabilidade × impacto) antes de recuar.',
      'Defina o “custo de não agir” — muitas vezes maior que o risco temido.',
    ],
  },
  EQUILIBRADO: {
    tension: 'EQUILIBRADO',
    title: 'Sustentar a coerência e desenvolver o time',
    focus: 'Sua leitura está equilibrada nos 4 Rs — consolide o padrão e apoie pares.',
    practices: [
      'Documente como você decide bem sob pressão e compartilhe com a equipe.',
      'Atue como referência em decisões difíceis de outros líderes.',
      'Mantenha o ritual de revisão para não perder a coerência sob estresse.',
    ],
  },
};

/** Pergunta ao Copiloto CRIVO (apoio reflexivo do líder). O contexto do ICD é
 *  enviado pelo cliente (dados do próprio usuário) para personalizar a resposta. */
export interface CopilotoAskRequest {
  question: string;
  context?: {
    score?: number;
    dominantPattern?: DominantPattern;
    dimensions?: Partial<IcdDimensions>;
  };
}

export interface CopilotoAskResponse {
  ok: boolean;
  /** Resposta do copiloto (quando ok). */
  answer?: string;
  /** Motivo quando indisponível (ex.: IA não configurada/desativada). */
  reason?: string;
}

/** Campanha de diagnóstico (ciclo de avaliação) com estatísticas agregadas. */
export interface CampaignSummary {
  id: string;
  name: string;
  description: string | null;
  sector: string | null;
  publicSlug: string | null;
  startsAt: string | null;
  endsAt: string | null;
  reminderAt: string | null;
  reminderSentAt: string | null;
  closedAt: string | null;
  status: 'OPEN' | 'CLOSED';
  createdAt: string;
  respondentes: number;
  totalParticipantes: number;
  adesao: number; // 0–100 (%)
  icdMedio: number | null;
}

/** Payload de criação de campanha (POST /icd/campaigns). */
export interface CreateCampaignRequest {
  name: string;
  description?: string;
  sector?: string;
  startsAt?: string; // ISO
  endsAt?: string;
  reminderAt?: string;
  /** Gerar slug público (link sem login). Default false. */
  generatePublicLink?: boolean;
}

/** Payload de edição (PATCH /icd/campaigns/:id). Todos opcionais. */
export interface UpdateCampaignRequest {
  name?: string;
  description?: string | null;
  sector?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  reminderAt?: string | null;
  regeneratePublicLink?: boolean;
  /** Limpa o slug público (campanha vira interna). */
  clearPublicLink?: boolean;
}

/** Resposta do GET /public/campaigns/:slug (acesso sem login). */
export interface PublicCampaignInfo {
  name: string;
  description: string | null;
  sector: string | null;
  status: 'OPEN' | 'CLOSED';
  startsAt: string | null;
  endsAt: string | null;
  /** Nome da empresa para exibição. */
  tenantName: string;
}

// =====================================================================
// Relatório Preliminar CRIVO (Briefing §5, Portal §7).
// Gerado por IA a partir do Diagnóstico Inicial do PlatformLead.
// =====================================================================

export const PRELIMINARY_REPORT_STATUSES = ['GERANDO', 'PRONTO', 'ENVIADO', 'ERRO'] as const;
export type PreliminaryReportStatus = (typeof PRELIMINARY_REPORT_STATUSES)[number];

export const PRELIMINARY_REPORT_STATUS_LABEL: Record<PreliminaryReportStatus, string> = {
  GERANDO: 'Gerando',
  PRONTO: 'Pronto',
  ENVIADO: 'Enviado',
  ERRO: 'Erro',
};

export interface PreliminaryReportData {
  id: string;
  platformLeadId: string;
  diagnosticScore: number;
  diagnosticLevel: MaturityLevel;
  diagnosticDimensions: Record<PreDiagnosticDimension, number>;
  topAttention: PreDiagnosticDimension;
  content: string;
  modelVersion: string;
  promptVersion: string;
  status: PreliminaryReportStatus;
  errorReason: string | null;
  sentTo: string | null;
  sentAt: string | null;
  emailProvider: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Payload POST /admin/preliminary-reports — gera e dispara envio. */
export interface GeneratePreliminaryReportRequest {
  platformLeadId: string;
  /** Destinatário do e-mail. Se omitido, usa email do lead. */
  sendTo?: string;
}

// =====================================================================
// Super Admin extras (#54) — Mentorias, Biblioteca de Ações, Textos
// editáveis, Academia global.
// =====================================================================

export const MENTORIA_FORMATS = ['ONLINE', 'PRESENCIAL', 'HIBRIDA'] as const;
export type MentoriaFormat = (typeof MENTORIA_FORMATS)[number];

export const MENTORIA_STATUSES = ['AGENDADA', 'REALIZADA', 'CANCELADA', 'REAGENDADA'] as const;
export type MentoriaStatus = (typeof MENTORIA_STATUSES)[number];

export const MENTORIA_FORMAT_LABEL: Record<MentoriaFormat, string> = {
  ONLINE: 'Online',
  PRESENCIAL: 'Presencial',
  HIBRIDA: 'Híbrida',
};

export const MENTORIA_STATUS_LABEL: Record<MentoriaStatus, string> = {
  AGENDADA: 'Agendada',
  REALIZADA: 'Realizada',
  CANCELADA: 'Cancelada',
  REAGENDADA: 'Reagendada',
};

export interface MentoriaData {
  id: string;
  tenantId: string;
  title: string;
  format: MentoriaFormat;
  mentorName: string;
  attendee: string;
  scheduledAt: string;
  durationMin: number;
  meetingUrl: string | null;
  location: string | null;
  status: MentoriaStatus;
  notes: string | null;
  recordingUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMentoriaRequest {
  tenantId: string;
  title: string;
  format: MentoriaFormat;
  mentorName: string;
  attendee: string;
  scheduledAt: string;
  durationMin?: number;
  meetingUrl?: string;
  location?: string;
  notes?: string;
}

export interface UpdateMentoriaRequest {
  title?: string;
  format?: MentoriaFormat;
  mentorName?: string;
  attendee?: string;
  scheduledAt?: string;
  durationMin?: number;
  meetingUrl?: string | null;
  location?: string | null;
  status?: MentoriaStatus;
  notes?: string | null;
  recordingUrl?: string | null;
}

/** Biblioteca de Ações modelo (catálogo CRIVO global). */
export interface ActionTemplateData {
  id: string;
  title: string;
  category: string;
  description: string | null;
  suggestedResponsible: string | null;
  expectedEvidence: string | null;
  defaultReviewDays: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertActionTemplateRequest {
  title: string;
  category: string;
  description?: string;
  suggestedResponsible?: string;
  expectedEvidence?: string;
  defaultReviewDays?: number;
  active?: boolean;
}

/** Texto editável pelo Super Admin sem deploy (key-value versionado). */
export interface EditableTextData {
  id: string;
  key: string;
  category: string;
  content: string;
  version: number;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertEditableTextRequest {
  key: string;
  category?: string;
  content: string;
}

/** Conteúdo global da Academia CRIVO (catálogo). */
export interface GlobalAcademyContentData {
  id: string;
  title: string;
  kind: string;
  description: string | null;
  url: string | null;
  category: string | null;
  tags: string[];
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertGlobalAcademyContentRequest {
  title: string;
  kind: string;
  description?: string;
  url?: string;
  category?: string;
  tags?: string[];
  published?: boolean;
}

// ── Custos Invisíveis (Fase 2 — §10/§14) ────────────────────────────────────
// Estimativa gerencial do custo oculto: por item, custo = variação × volume ×
// custo unitário. Três cenários (faixa) + nível de confiança. É ESTIMATIVA de
// apoio à decisão — nunca afirma economia garantida nem causalidade automática.

export interface InvisibleCostItem {
  key: string;
  label: string;
  indicator?: string; // indicador-base (turnover, absenteísmo…)
  variation: number; // variação do indicador (ex.: nº de saídas, dias, %)
  volume: number; // volume afetado (ex.: colaboradores, horas)
  unitCost: number; // custo unitário estimado (R$)
  note?: string;
}

export interface InvisibleCostScenarios {
  conservador: number; // multiplicador cauteloso → assume custo MAIOR
  moderado: number;
  otimista: number; // melhor caso → custo MENOR
}

export const DEFAULT_COST_SCENARIOS: InvisibleCostScenarios = {
  conservador: 1.3,
  moderado: 1,
  otimista: 0.7,
};

export type CostConfidence = 'ALTA' | 'MEDIA' | 'BAIXA';

export const COST_CONFIDENCE_LABEL: Record<CostConfidence, string> = {
  ALTA: 'Alta',
  MEDIA: 'Média',
  BAIXA: 'Baixa',
};

export interface InvisibleCostItemResult {
  key: string;
  label: string;
  base: number;
  conservador: number;
  moderado: number;
  otimista: number;
}

export interface InvisibleCostResult {
  items: InvisibleCostItemResult[];
  total: { base: number; conservador: number; moderado: number; otimista: number };
}

/**
 * Estima os custos invisíveis: base = variação × volume × custo unitário; aplica
 * os cenários (faixa) por item e soma. Pura — usável no front e no back.
 */
export function computeInvisibleCosts(
  items: InvisibleCostItem[],
  scenarios: InvisibleCostScenarios = DEFAULT_COST_SCENARIOS,
): InvisibleCostResult {
  const results: InvisibleCostItemResult[] = items.map((it) => {
    const base = (Number(it.variation) || 0) * (Number(it.volume) || 0) * (Number(it.unitCost) || 0);
    return {
      key: it.key,
      label: it.label,
      base,
      conservador: base * scenarios.conservador,
      moderado: base * scenarios.moderado,
      otimista: base * scenarios.otimista,
    };
  });
  const sum = (f: 'base' | 'conservador' | 'moderado' | 'otimista') =>
    results.reduce((s, x) => s + x[f], 0);
  return {
    items: results,
    total: {
      base: sum('base'),
      conservador: sum('conservador'),
      moderado: sum('moderado'),
      otimista: sum('otimista'),
    },
  };
}

/** Itens-modelo (presets) dos vetores clássicos do custo psicossocial. Editáveis. */
export const INVISIBLE_COST_PRESETS: InvisibleCostItem[] = [
  { key: 'turnover', label: 'Reposição (turnover)', indicator: 'Saídas/ano', variation: 18, volume: 1, unitCost: 9000 },
  { key: 'absenteismo', label: 'Absenteísmo', indicator: 'Dias perdidos/ano', variation: 600, volume: 1, unitCost: 205 },
  { key: 'presenteismo', label: 'Presenteísmo', indicator: 'Perda de produtividade (%)', variation: 0.08, volume: 100, unitCost: 54000 },
];

// ── People Analytics (Fase 4 — §10/§14) ─────────────────────────────────────
// Indicadores de RH da empresa por período, com tendência (Δ vs período anterior).
// Cruza com os dados CRIVO; a IA Analítica interpreta — sem afirmar causalidade.

export interface PeopleIndicatorDef {
  key: string;
  label: string;
  unit: string;
  higherIsBetter: boolean; // produtividade ↑ é bom; turnover ↑ é ruim
}

export const PEOPLE_INDICATORS: PeopleIndicatorDef[] = [
  { key: 'turnover', label: 'Turnover', unit: '%', higherIsBetter: false },
  { key: 'absenteismo', label: 'Absenteísmo', unit: '%', higherIsBetter: false },
  { key: 'afastamentos', label: 'Afastamentos', unit: 'nº', higherIsBetter: false },
  { key: 'horasExtras', label: 'Horas extras', unit: 'h', higherIsBetter: false },
  { key: 'retrabalho', label: 'Retrabalho', unit: '%', higherIsBetter: false },
  { key: 'produtividade', label: 'Produtividade', unit: 'índice', higherIsBetter: true },
  { key: 'reclamacoes', label: 'Reclamações', unit: 'nº', higherIsBetter: false },
  { key: 'denuncias', label: 'Denúncias', unit: 'nº', higherIsBetter: false },
];

export interface PeoplePeriod {
  period: string; // ex.: "2026-Q1" ou "2026-01"
  headcount?: number | null;
  values: Record<string, number | null>; // indicatorKey → valor
}

export interface PeopleTrend {
  key: string;
  label: string;
  unit: string;
  higherIsBetter: boolean;
  latest: number | null;
  previous: number | null;
  delta: number | null;
  deltaPct: number | null;
  direction: 'up' | 'down' | 'flat' | 'na';
  good: boolean | null; // a direção é favorável? (null se sem dado)
}

export interface PeopleTrendsResult {
  periodsCount: number;
  latestPeriod: string | null;
  trends: PeopleTrend[];
}

/** Tendência período-a-período de cada indicador. Pura — usável no front e no back. */
export function computePeopleTrends(periods: PeoplePeriod[]): PeopleTrendsResult {
  const sorted = [...periods].sort((a, b) => a.period.localeCompare(b.period));
  const n = sorted.length;
  const last = n > 0 ? sorted[n - 1] : null;
  const prev = n > 1 ? sorted[n - 2] : null;
  const trends: PeopleTrend[] = PEOPLE_INDICATORS.map((def) => {
    const latest = last?.values?.[def.key] ?? null;
    const previous = prev?.values?.[def.key] ?? null;
    let delta: number | null = null;
    let deltaPct: number | null = null;
    let direction: PeopleTrend['direction'] = 'na';
    let good: boolean | null = null;
    if (latest != null && previous != null) {
      delta = Math.round((latest - previous) * 100) / 100;
      deltaPct = previous !== 0 ? Math.round(((latest - previous) / Math.abs(previous)) * 1000) / 10 : null;
      direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
      good = direction === 'flat' ? null : def.higherIsBetter ? direction === 'up' : direction === 'down';
    }
    return { key: def.key, label: def.label, unit: def.unit, higherIsBetter: def.higherIsBetter, latest, previous, delta, deltaPct, direction, good };
  });
  return { periodsCount: n, latestPeriod: last?.period ?? null, trends };
}

// ── Base CRIVO / Benchmarks (Fase 5 — §11) ──────────────────────────────────
// Agregação ANONIMIZADA entre empresas (benchmarks por grupo: porte/setor), com
// SUPRESSÃO por volume mínimo — nenhum recorte com poucas empresas é revelado.

export const PORTE_BANDS: { key: string; label: string; min: number; max: number }[] = [
  { key: 'micro', label: 'Micro (1–9)', min: 1, max: 9 },
  { key: 'pequeno', label: 'Pequeno (10–49)', min: 10, max: 49 },
  { key: 'medio', label: 'Médio (50–249)', min: 50, max: 249 },
  { key: 'grande', label: 'Grande (250+)', min: 250, max: Number.POSITIVE_INFINITY },
];

export function porteBandOf(headcount: number | null | undefined): string | null {
  if (headcount == null || !Number.isFinite(headcount) || headcount < 1) return null;
  return PORTE_BANDS.find((x) => headcount >= x.min && headcount <= x.max)?.label ?? null;
}

export interface BenchmarkRecord {
  group: string; // rótulo do recorte (ex.: "Pequeno · Saúde")
  indicators: Record<string, number | null>;
}

export interface BenchmarkGroup {
  group: string;
  count: number;
  suppressed: boolean;
  averages: Record<string, number>; // só preenchido quando não suprimido
}

export interface BenchmarkResult {
  minCount: number;
  totalRecords: number;
  groups: BenchmarkGroup[];
  suppressedGroups: number;
}

/**
 * Agrupa registros por `group`, calcula a média por indicador e SUPRIME recortes
 * com menos de `minCount` empresas (anonimização §11). Pura.
 */
export function aggregateBenchmarks(records: BenchmarkRecord[], minCount = 3): BenchmarkResult {
  const map = new Map<string, BenchmarkRecord[]>();
  for (const r of records) {
    const arr = map.get(r.group) ?? [];
    arr.push(r);
    map.set(r.group, arr);
  }
  let suppressedGroups = 0;
  const groups: BenchmarkGroup[] = Array.from(map.entries())
    .map(([group, list]) => {
      const suppressed = list.length < minCount;
      if (suppressed) suppressedGroups += 1;
      const averages: Record<string, number> = {};
      if (!suppressed) {
        const keys = new Set<string>();
        for (const r of list) for (const k of Object.keys(r.indicators)) keys.add(k);
        for (const k of keys) {
          const vals = list.map((r) => r.indicators[k]).filter((v): v is number => v != null && Number.isFinite(v));
          if (vals.length) averages[k] = Math.round((vals.reduce((s, x) => s + x, 0) / vals.length) * 100) / 100;
        }
      }
      return { group, count: list.length, suppressed, averages };
    })
    .sort((a, b) => b.count - a.count);
  return { minCount, totalRecords: records.length, groups, suppressedGroups };
}

// ── Notificações & Travas operacionais (Fase 3 — §12) ───────────────────────
// O sistema CONDUZ a operação: deriva alertas e travas críticas do estado atual
// (campanhas, plano de ação) — não substitui decisão humana, sinaliza.

export type AlertSeverity = 'info' | 'warn' | 'high';
export const LOW_ADHESION_PCT = 30;

export interface OperationalAlert {
  kind: string;
  severity: AlertSeverity;
  message: string;
}
export interface OperationalLock {
  kind: string;
  message: string;
}

export interface AlertsSnapshot {
  campaigns: { name: string; active: boolean; adesao: number }[];
  actionItems: { title: string; status: string; dueDateMs: number | null; hasExpectedEvidence: boolean; hasResponsible: boolean }[];
  unvalidatedPlans: { title: string; itemCount: number }[];
}

export interface OperationalAlertsResult {
  alerts: OperationalAlert[];
  locks: OperationalLock[];
}

/** Deriva alertas (§12) + travas críticas do estado do tenant. Pura — `nowMs`
 * é injetado pelo chamador para manter a função determinística/testável. */
export function computeOperationalAlerts(s: AlertsSnapshot, nowMs: number): OperationalAlertsResult {
  const alerts: OperationalAlert[] = [];
  const locks: OperationalLock[] = [];

  for (const c of s.campaigns) {
    if (c.active && c.adesao < LOW_ADHESION_PCT) {
      alerts.push({ kind: 'baixa-adesao', severity: 'warn', message: `Campanha "${c.name}": adesão baixa (${c.adesao}%).` });
    }
  }

  for (const it of s.actionItems) {
    const done = it.status === 'CONCLUIDA';
    if (done) continue;
    if (it.dueDateMs != null && it.dueDateMs < nowMs) {
      alerts.push({ kind: 'acao-atrasada', severity: 'high', message: `Ação "${it.title}" está atrasada.` });
    }
    if (it.dueDateMs == null) {
      locks.push({ kind: 'sem-prazo', message: `Ação "${it.title}" sem prazo definido.` });
    }
    if (!it.hasResponsible) {
      locks.push({ kind: 'sem-responsavel', message: `Ação "${it.title}" sem responsável definido.` });
    }
    if (!it.hasExpectedEvidence) {
      locks.push({ kind: 'sem-evidencia-esperada', message: `Ação "${it.title}" sem evidência esperada.` });
    } else if (it.status === 'EM_ANDAMENTO' || it.status === 'APROVADA') {
      alerts.push({ kind: 'evidencia-pendente', severity: 'warn', message: `Ação "${it.title}": evidência pendente.` });
    }
  }

  for (const p of s.unvalidatedPlans) {
    if (p.itemCount > 0) {
      locks.push({ kind: 'plano-nao-validado', message: `Plano "${p.title}" não validado — dossiê bloqueado até a validação.` });
    }
  }

  return { alerts, locks };
}
