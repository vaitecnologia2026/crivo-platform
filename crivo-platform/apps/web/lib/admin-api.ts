// Cliente da API do CONTROL PLANE (super admin). Sessão SEPARADA da do tenant:
// token próprio (crivo_admin_token) e redirect para /superadm em 401 — para que
// as duas sessões (plataforma vs. painel global) nunca se misturem.
import type {
  ActionTemplateData,
  AiSettingsData,
  AiTestResult,
  ContractData,
  CreateMentoriaRequest,
  CreateTenantRequest,
  CreateUserRequest,
  CreateUserResult,
  EditableTextData,
  GeneratePreliminaryReportRequest,
  GlobalAcademyContentData,
  MentoriaData,
  NotificationSettingData,
  Plan,
  PlatformLeadStage,
  PlatformLeadSummary,
  PlatformLoginResponse,
  PreliminaryReportData,
  ProductDetail,
  ProductSummary,
  ProvisionResult,
  TenantBrandingData,
  BusinessGroupSummary,
  DashboardData,
  GroupAccessEntry,
  GroupOverview,
  TenantDomainData,
  TenantModuleSummary,
  TenantSummary,
  UpdateBrandingRequest,
  UpdateMentoriaRequest,
  UpdateNotificationSettingRequest,
  UpdateUserRequest,
  UserSummary,
  UpsertActionTemplateRequest,
  UpsertAiSettingsRequest,
  UpsertContractRequest,
  UpsertEditableTextRequest,
  UpsertGlobalAcademyContentRequest,
  UpsertProductRequest,
  UsageSummary,
  AddonSummary,
  AddonUpsertRequest,
} from "@crivo/types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

function apiBase(): string {
  if (!API) {
    throw new Error(
      "NEXT_PUBLIC_API_URL não configurada. Defina a URL da API no ambiente (Vercel).",
    );
  }
  return API;
}

const TOKEN_KEY = "crivo_admin_token";

export function getAdminToken(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
}
export function setAdminToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearAdminToken() {
  localStorage.removeItem(TOKEN_KEY);
}

interface AdminFetchOptions {
  /** Em 401, limpa a sessão e volta ao login do painel. Desligue no login. */
  redirectOn401?: boolean;
}

async function adminFetch<T>(
  path: string,
  init: RequestInit = {},
  { redirectOn401 = true }: AdminFetchOptions = {},
): Promise<T> {
  const token = getAdminToken();
  let res: Response;
  try {
    res = await fetch(`${apiBase()}${path}`, {
      ...init,
      // Nunca servir do cache do navegador: o funil/dashboard tem que refletir
      // o estado atual do banco (leads recém-criados aparecem na hora).
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
      signal: init.signal ?? AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error("Serviço indisponível. Verifique sua conexão e tente novamente.");
  }

  if (res.status === 401 && redirectOn401) {
    clearAdminToken();
    if (typeof window !== "undefined") window.location.href = "/superadm";
    throw new Error("Sessão expirada");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? "Erro na requisição");
  }
  return res.json() as Promise<T>;
}

// ── Endpoints do control plane ──

export function adminLogin(
  email: string,
  password: string,
  totp?: string,
): Promise<PlatformLoginResponse> {
  // 401 aqui = credenciais inválidas / MFA (não sessão expirada) → não redireciona.
  return adminFetch<PlatformLoginResponse>(
    "/admin/auth/login",
    { method: "POST", body: JSON.stringify({ email, password, totp: totp || undefined }) },
    { redirectOn401: false },
  );
}

/** Logout: revoga a sessão do super admin no servidor antes de limpar o token local. */
export function adminLogout(): Promise<{ ok: true }> {
  return adminFetch<{ ok: true }>("/admin/auth/logout", { method: "POST" }, { redirectOn401: false });
}

export function listTenants(): Promise<TenantSummary[]> {
  return adminFetch<TenantSummary[]>("/admin/tenants");
}

export function createTenant(dto: CreateTenantRequest): Promise<ProvisionResult> {
  return adminFetch<ProvisionResult>("/admin/tenants", {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export function suspendTenant(id: string): Promise<TenantSummary> {
  return adminFetch<TenantSummary>(`/admin/tenants/${id}/suspend`, { method: "PATCH" });
}

export function activateTenant(id: string): Promise<TenantSummary> {
  return adminFetch<TenantSummary>(`/admin/tenants/${id}/activate`, { method: "PATCH" });
}

export function deleteTenant(id: string): Promise<TenantSummary> {
  return adminFetch<TenantSummary>(`/admin/tenants/${id}`, { method: "DELETE" });
}

/** Adicionais precificados (Tela 05 · modelo Adicional). */
export function listAddons(): Promise<AddonSummary[]> {
  return adminFetch<AddonSummary[]>("/admin/addons");
}
export function upsertAddon(moduleCode: string, input: AddonUpsertRequest): Promise<AddonSummary> {
  return adminFetch<AddonSummary>(`/admin/addons/${moduleCode}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}
export function archiveLead(id: string, archived = true): Promise<PlatformLeadSummary> {
  return adminFetch<PlatformLeadSummary>(`/admin/leads/${id}/archive`, {
    method: "PATCH",
    body: JSON.stringify({ archived }),
  });
}
export function deleteAddon(moduleCode: string): Promise<{ ok: true }> {
  return adminFetch<{ ok: true }>(`/admin/addons/${moduleCode}`, { method: "DELETE" });
}

/** Cadastro do CNPJ (Tela 06): CNPJ, matriz/filial, responsável interno. */
export function setTenantProfile(
  id: string,
  input: {
    cnpj?: string | null;
    headquarterType?: string | null;
    internalResponsible?: string | null;
    consentAnonymized?: boolean;
    consentBenchmark?: boolean;
    consentCase?: boolean;
    consentLogo?: boolean;
    consentTestimonial?: boolean;
  },
): Promise<TenantSummary> {
  return adminFetch<TenantSummary>(`/admin/tenants/${id}/profile`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

// ── Grupos Empresariais (F1 · Caderno Tela 06) ──

export function listGroups(): Promise<BusinessGroupSummary[]> {
  return adminFetch<BusinessGroupSummary[]>("/admin/groups");
}

export function createGroup(name: string): Promise<BusinessGroupSummary> {
  return adminFetch<BusinessGroupSummary>("/admin/groups", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function renameGroup(id: string, name: string): Promise<{ ok: true }> {
  return adminFetch<{ ok: true }>(`/admin/groups/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export function deleteGroup(id: string): Promise<{ ok: true }> {
  return adminFetch<{ ok: true }>(`/admin/groups/${id}`, { method: "DELETE" });
}

/** Vincula (groupId) ou desvincula (null) a empresa de um grupo. */
export function setTenantGroup(tenantId: string, groupId: string | null): Promise<TenantSummary> {
  return adminFetch<TenantSummary>(`/admin/tenants/${tenantId}/group`, {
    method: "PATCH",
    body: JSON.stringify({ groupId }),
  });
}

/** F2 — visão consolidada do grupo (agregados por CNPJ; acesso auditado). */
export function getGroupOverview(id: string): Promise<GroupOverview> {
  return adminFetch<GroupOverview>(`/admin/groups/${id}/overview`);
}

// ── F3 — consolidado do grupo no portal do cliente (gestão) ──

export function setGroupConsolidated(id: string, enabled: boolean): Promise<{ ok: true }> {
  return adminFetch<{ ok: true }>(`/admin/groups/${id}/consolidated`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
}

export function listGroupAccess(id: string): Promise<GroupAccessEntry[]> {
  return adminFetch<GroupAccessEntry[]>(`/admin/groups/${id}/access`);
}

export function addGroupAccess(id: string, email: string): Promise<GroupAccessEntry> {
  return adminFetch<GroupAccessEntry>(`/admin/groups/${id}/access`, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function removeGroupAccess(accessId: string): Promise<{ ok: true }> {
  return adminFetch<{ ok: true }>(`/admin/groups/access/${accessId}`, { method: "DELETE" });
}

// ── Módulos por empresa (F4) ──

export function listTenantModules(id: string): Promise<TenantModuleSummary[]> {
  return adminFetch<TenantModuleSummary[]>(`/admin/tenants/${id}/modules`);
}

/** (Des)ativa um módulo; a API valida o plano e devolve o catálogo atualizado. */
export function setTenantModule(
  id: string,
  code: string,
  enabled: boolean,
): Promise<TenantModuleSummary[]> {
  return adminFetch<TenantModuleSummary[]>(`/admin/tenants/${id}/modules/${code}`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
}

/** Troca o plano da empresa (a API re-sincroniza os módulos). */
export function setTenantPlan(id: string, plan: Plan): Promise<TenantSummary> {
  return adminFetch<TenantSummary>(`/admin/tenants/${id}/plan`, {
    method: "PATCH",
    body: JSON.stringify({ plan }),
  });
}

export function getTenantUsage(id: string): Promise<UsageSummary> {
  return adminFetch<UsageSummary>(`/admin/tenants/${id}/usage`);
}

// ── Usuários da empresa (gestão pelo Super Admin) ──

export function listTenantUsers(tenantId: string): Promise<UserSummary[]> {
  return adminFetch<UserSummary[]>(`/admin/tenants/${tenantId}/users`);
}

/** Uso de assentos da empresa: usuários ativos atuais + limite do plano (null = ilimitado). */
export function getTenantUserSeats(
  tenantId: string,
): Promise<{ active: number; max: number | null }> {
  return adminFetch<{ active: number; max: number | null }>(
    `/admin/tenants/${tenantId}/users/seats`,
  );
}

/** Cria um usuário na empresa (senha temporária retornada 1× se ausente). */
export function createTenantUser(
  tenantId: string,
  body: CreateUserRequest,
): Promise<CreateUserResult> {
  return adminFetch<CreateUserResult>(`/admin/tenants/${tenantId}/users`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Atualiza papel / (des)ativa um usuário da empresa. */
export function updateTenantUser(
  tenantId: string,
  id: string,
  body: UpdateUserRequest,
): Promise<UserSummary> {
  return adminFetch<UserSummary>(`/admin/tenants/${tenantId}/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

// ── Visão geral + auditoria (control plane) ──

export interface AdminOverview {
  totalTenants: number;
  byStatus: Record<string, number>;
  byPlan: Record<string, number>;
  totalUsers: number;
  activeUsers: number;
  totalLeads: number;
  recentTenants: TenantSummary[];
}

export interface AuditEntry {
  id: string;
  action: string;
  actorEmail: string | null;
  target: string | null;
  at: string;
}

export function getOverview(): Promise<AdminOverview> {
  return adminFetch<AdminOverview>("/admin/overview");
}

/** Dashboard de Gestão CRIVO (Caderno Tela 01). `days` = período; filtros opcionais. */
export function getDashboard(
  days = 30,
  filters: { origem?: string; groupId?: string; tenantId?: string } = {},
): Promise<DashboardData> {
  const q = new URLSearchParams({ days: String(days) });
  if (filters.origem) q.set("origem", filters.origem);
  if (filters.groupId) q.set("groupId", filters.groupId);
  if (filters.tenantId) q.set("tenantId", filters.tenantId);
  return adminFetch<DashboardData>(`/admin/dashboard?${q.toString()}`);
}

export function getAuditLog(): Promise<AuditEntry[]> {
  return adminFetch<AuditEntry[]>("/admin/audit");
}

// ── CRM do super admin (funil comercial) ──

export function listLeads(): Promise<PlatformLeadSummary[]> {
  return adminFetch<PlatformLeadSummary[]>("/admin/leads");
}

export function setLeadStage(
  id: string,
  stage: PlatformLeadStage,
  lostReason?: string,
): Promise<PlatformLeadSummary> {
  return adminFetch<PlatformLeadSummary>(`/admin/leads/${id}/stage`, {
    method: "PATCH",
    body: JSON.stringify(lostReason !== undefined ? { stage, lostReason } : { stage }),
  });
}

/** Registra o 1º contato com o lead (mede o tempo de resposta comercial). */
export function markFirstContact(id: string): Promise<PlatformLeadSummary> {
  return adminFetch<PlatformLeadSummary>(`/admin/leads/${id}/first-contact`, { method: "PATCH" });
}

/** [2] Registra a origem/canal do lead. */
export function setLeadOrigin(id: string, origin: string): Promise<PlatformLeadSummary> {
  return adminFetch<PlatformLeadSummary>(`/admin/leads/${id}/origin`, {
    method: "PATCH",
    body: JSON.stringify({ origin }),
  });
}

/** [4] Registra a solução de interesse (pré-venda) do lead. null limpa. */
export function setLeadInterest(id: string, interestProductId: string | null): Promise<PlatformLeadSummary> {
  return adminFetch<PlatformLeadSummary>(`/admin/leads/${id}/interest`, {
    method: "PATCH",
    body: JSON.stringify({ interestProductId }),
  });
}

/** [5] Registra o follow-up / próxima ação do lead (data + nota). */
export function setLeadNextAction(
  id: string,
  nextActionAt: string | null,
  nextActionNote: string | null,
): Promise<PlatformLeadSummary> {
  return adminFetch<PlatformLeadSummary>(`/admin/leads/${id}/next-action`, {
    method: "PATCH",
    body: JSON.stringify({ nextActionAt, nextActionNote }),
  });
}

/** Dados comerciais do lead: responsável, valor proposto, proposta enviada, adicionais. */
export function setLeadCommercial(
  id: string,
  input: {
    commercialOwner?: string | null;
    proposedValueCents?: number | null;
    proposalSentAt?: string | null;
    potentialAddons?: string[];
  },
): Promise<PlatformLeadSummary> {
  return adminFetch<PlatformLeadSummary>(`/admin/leads/${id}/commercial`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function setLeadNotes(id: string, notes: string): Promise<PlatformLeadSummary> {
  return adminFetch<PlatformLeadSummary>(`/admin/leads/${id}/notes`, {
    method: "PATCH",
    body: JSON.stringify({ notes }),
  });
}

/** Converte o lead em cliente provisionando pela estrutura do produto. */
export function convertLead(id: string, productId: string): Promise<ProvisionResult> {
  return adminFetch<ProvisionResult>(`/admin/leads/${id}/convert`, {
    method: "POST",
    body: JSON.stringify({ productId }),
  });
}

/** Cria um lead a partir de uma consulta de CNPJ (Dashboard); se houver productId, já converte. */
export function createLeadFromCnpj(input: {
  cnpj: string;
  numeroColaboradores?: number;
  name?: string;
  email?: string;
  productId?: string;
}): Promise<{ lead: PlatformLeadSummary } & Partial<ProvisionResult>> {
  return adminFetch("/admin/leads/from-cnpj", { method: "POST", body: JSON.stringify(input) });
}

/** #12 — Envia o acesso (login + senha) do cliente já convertido por e-mail. */
export function sendLeadAccess(
  id: string,
): Promise<{ sent: boolean; provider: string; to: string; tempPassword: string; reason?: string }> {
  return adminFetch(`/admin/leads/${id}/send-access`, { method: "POST" });
}

/** #18 — Zera os dados de teste (mantém login, produtos e RBAC). Exige confirm "ZERAR". */
export function resetTestData(
  confirm: string,
): Promise<{ ok: true; deleted: Record<string, number> }> {
  return adminFetch(`/admin/leads/reset-data`, {
    method: "POST",
    body: JSON.stringify({ confirm }),
  });
}

/** Remove leads duplicados pelo mesmo CNPJ (mantém convertidos + o melhor aberto). */
export function dedupLeads(): Promise<{ ok: true; deleted: number; kept: number }> {
  return adminFetch(`/admin/leads/dedup`, { method: "POST" });
}

// ── Catálogo de produtos (product-driven) ──

export function listProducts(): Promise<ProductSummary[]> {
  return adminFetch<ProductSummary[]>("/admin/products");
}

export function getProduct(id: string): Promise<ProductDetail> {
  return adminFetch<ProductDetail>(`/admin/products/${id}`);
}

export function createProduct(dto: UpsertProductRequest): Promise<ProductDetail> {
  return adminFetch<ProductDetail>("/admin/products", {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export function updateProduct(id: string, dto: UpsertProductRequest): Promise<ProductDetail> {
  return adminFetch<ProductDetail>(`/admin/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(dto),
  });
}

export function deleteProduct(id: string): Promise<{ ok: true }> {
  return adminFetch<{ ok: true }>(`/admin/products/${id}`, { method: "DELETE" });
}

// ── Configuração de IA (auditoria 2.3.1) ──

export function getAiSettings(): Promise<AiSettingsData> {
  return adminFetch<AiSettingsData>("/admin/ai-settings");
}

export function updateAiSettings(dto: UpsertAiSettingsRequest): Promise<AiSettingsData> {
  return adminFetch<AiSettingsData>("/admin/ai-settings", {
    method: "PUT",
    body: JSON.stringify(dto),
  });
}

export function testAiConnection(apiKey?: string): Promise<AiTestResult> {
  return adminFetch<AiTestResult>("/admin/ai-settings/test", {
    method: "POST",
    body: JSON.stringify(apiKey ? { apiKey } : {}),
  });
}

// ── Central de Prompts da IA (Caderno §10 · P0-c) ──

export interface AiPromptItem {
  useCase: string;
  label: string;
  description: string;
  content: string;
  isDefault: boolean;
  version: number;
  updatedBy: string | null;
  updatedAt: string | null;
}

export function getAiPrompts(): Promise<AiPromptItem[]> {
  return adminFetch<AiPromptItem[]>("/admin/ai/prompts");
}

export function updateAiPrompt(useCase: string, content: string): Promise<AiPromptItem> {
  return adminFetch<AiPromptItem>(`/admin/ai/prompts/${useCase}`, {
    method: "PUT",
    body: JSON.stringify({ content }),
  });
}

export function resetAiPrompt(useCase: string): Promise<AiPromptItem> {
  return adminFetch<AiPromptItem>(`/admin/ai/prompts/${useCase}`, { method: "DELETE" });
}

// ── Configuração de Notificações (push FCM + gates por gatilho) ──

export function getNotificationSettings(): Promise<NotificationSettingData[]> {
  return adminFetch<NotificationSettingData[]>("/admin/notification-settings");
}

export function updateNotificationSetting(
  key: string,
  dto: UpdateNotificationSettingRequest,
): Promise<NotificationSettingData> {
  return adminFetch<NotificationSettingData>(
    `/admin/notification-settings/${encodeURIComponent(key)}`,
    { method: "PUT", body: JSON.stringify(dto) },
  );
}

// ── Contrato por empresa (Briefing §11) ──

/** Linha da tabela central "Contratos e Liberações" (modelo aprovado). */
export interface ContractListItem {
  id: string;
  shortId: string;
  clientName: string;
  byGroup: boolean;
  tenantId: string | null;
  groupId: string | null;
  productName: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  responsible: string | null;
  rounds: number;
  addonsCount: number;
  mrrCents: number;
  updatedAt: string;
}

export function listAllContracts(): Promise<ContractListItem[]> {
  return adminFetch<ContractListItem[]>("/admin/contracts");
}

// ── Usuários CRIVO do painel (função organizacional) ──

export interface PlatformUserData {
  id: string;
  name: string;
  email: string;
  role: string | null;
  active: boolean;
  createdAt: string;
}

export function listPlatformUsers(): Promise<PlatformUserData[]> {
  return adminFetch<PlatformUserData[]>("/admin/platform-users");
}

export function createPlatformUser(input: { name: string; email: string; role?: string }): Promise<{ user: PlatformUserData; tempPassword: string }> {
  return adminFetch("/admin/platform-users", { method: "POST", body: JSON.stringify(input) });
}

export function updatePlatformUser(
  id: string,
  input: { role?: string | null; active?: boolean; resetPassword?: boolean },
): Promise<{ user: PlatformUserData; tempPassword?: string }> {
  return adminFetch(`/admin/platform-users/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function getContract(tenantId: string): Promise<ContractData | null> {
  return adminFetch<ContractData | null>(`/admin/tenants/${tenantId}/contract`);
}

export function upsertContract(
  tenantId: string,
  dto: UpsertContractRequest,
): Promise<ContractData> {
  return adminFetch<ContractData>(`/admin/tenants/${tenantId}/contract`, {
    method: "PUT",
    body: JSON.stringify(dto),
  });
}

/** Contrato do GRUPO (Tela 05 [5]) — aplica-se a todos os CNPJs do grupo. */
export function getGroupContract(groupId: string): Promise<ContractData | null> {
  return adminFetch<ContractData | null>(`/admin/groups/${groupId}/contract`);
}
export function upsertGroupContract(
  groupId: string,
  dto: UpsertContractRequest,
): Promise<ContractData> {
  return adminFetch<ContractData>(`/admin/groups/${groupId}/contract`, {
    method: "PUT",
    body: JSON.stringify(dto),
  });
}

// ── White-label: branding + domínios (F5) ──

export function getTenantBranding(id: string): Promise<TenantBrandingData> {
  return adminFetch<TenantBrandingData>(`/admin/tenants/${id}/branding`);
}

export function updateTenantBranding(
  id: string,
  dto: UpdateBrandingRequest,
): Promise<TenantBrandingData> {
  return adminFetch<TenantBrandingData>(`/admin/tenants/${id}/branding`, {
    method: "PUT",
    body: JSON.stringify(dto),
  });
}

export function listTenantDomains(id: string): Promise<TenantDomainData[]> {
  return adminFetch<TenantDomainData[]>(`/admin/tenants/${id}/domains`);
}

export function addTenantDomain(id: string, domain: string): Promise<TenantDomainData[]> {
  return adminFetch<TenantDomainData[]>(`/admin/tenants/${id}/domains`, {
    method: "POST",
    body: JSON.stringify({ domain }),
  });
}

export function verifyTenantDomain(id: string, domainId: string): Promise<TenantDomainData[]> {
  return adminFetch<TenantDomainData[]>(`/admin/tenants/${id}/domains/${domainId}/verify`, {
    method: "POST",
  });
}

export function setPrimaryTenantDomain(id: string, domainId: string): Promise<TenantDomainData[]> {
  return adminFetch<TenantDomainData[]>(`/admin/tenants/${id}/domains/${domainId}/primary`, {
    method: "PATCH",
  });
}

export function removeTenantDomain(id: string, domainId: string): Promise<TenantDomainData[]> {
  return adminFetch<TenantDomainData[]>(`/admin/tenants/${id}/domains/${domainId}`, {
    method: "DELETE",
  });
}

// ── Relatório Preliminar CRIVO (Briefing §5 / Portal §7) ──

export function listPreliminaryReportsByLead(platformLeadId: string): Promise<PreliminaryReportData[]> {
  return adminFetch<PreliminaryReportData[]>(`/admin/preliminary-reports?platformLeadId=${platformLeadId}`);
}

export function generatePreliminaryReport(dto: GeneratePreliminaryReportRequest): Promise<PreliminaryReportData> {
  return adminFetch<PreliminaryReportData>("/admin/preliminary-reports/generate", {
    method: "POST",
    body: JSON.stringify(dto),
    // Geração via IA leva mais que o timeout padrão (15s). Espera até 60s
    // (alinhado ao maxDuration da função serverless da API).
    signal: AbortSignal.timeout(60000),
  });
}

export function resendPreliminaryReport(id: string, sendTo: string): Promise<PreliminaryReportData> {
  return adminFetch<PreliminaryReportData>(`/admin/preliminary-reports/${id}/resend`, {
    method: "POST",
    body: JSON.stringify({ sendTo }),
  });
}

/**
 * Envia o Relatório Preliminar (gerado pela IA) por e-mail via RELAY no Vercel.
 * O backend gera o conteúdo mas não consegue mandar SMTP (egress bloqueado no
 * Railway); o relay (crivo-site) renderiza e envia. O relay valida o token de
 * super admin contra a API, então é seguro.
 */
export async function sendReportEmailViaRelay(input: {
  to: string;
  leadName?: string;
  company?: string | null;
  markdown: string;
  footer?: string;
}): Promise<{ ok: boolean; provider?: string; error?: string }> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://crivolegacy.com.br";
  const token = getAdminToken();
  try {
    const r = await fetch(`${base}/api/send-report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(20000),
    });
    return (await r.json()) as { ok: boolean; provider?: string; error?: string };
  } catch {
    return { ok: false, error: "Relay de e-mail indisponível." };
  }
}

// ── Super Admin extras (#54) ────────────────────────────────────────

export function listMentorias(tenantId?: string): Promise<MentoriaData[]> {
  const qs = tenantId ? `?tenantId=${tenantId}` : "";
  return adminFetch<MentoriaData[]>(`/admin/mentorias${qs}`);
}
export function createMentoria(dto: CreateMentoriaRequest): Promise<MentoriaData> {
  return adminFetch<MentoriaData>("/admin/mentorias", { method: "POST", body: JSON.stringify(dto) });
}
export function updateMentoria(id: string, dto: UpdateMentoriaRequest): Promise<MentoriaData> {
  return adminFetch<MentoriaData>(`/admin/mentorias/${id}`, { method: "PATCH", body: JSON.stringify(dto) });
}
export function removeMentoria(id: string): Promise<{ ok: true }> {
  return adminFetch<{ ok: true }>(`/admin/mentorias/${id}`, { method: "DELETE" });
}

export function listActionTemplates(category?: string): Promise<ActionTemplateData[]> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : "";
  return adminFetch<ActionTemplateData[]>(`/admin/action-templates${qs}`);
}
export function createActionTemplate(dto: UpsertActionTemplateRequest): Promise<ActionTemplateData> {
  return adminFetch<ActionTemplateData>("/admin/action-templates", { method: "POST", body: JSON.stringify(dto) });
}
export function updateActionTemplate(id: string, dto: UpsertActionTemplateRequest): Promise<ActionTemplateData> {
  return adminFetch<ActionTemplateData>(`/admin/action-templates/${id}`, { method: "PUT", body: JSON.stringify(dto) });
}
export function removeActionTemplate(id: string): Promise<{ ok: true }> {
  return adminFetch<{ ok: true }>(`/admin/action-templates/${id}`, { method: "DELETE" });
}

export function listEditableTexts(category?: string): Promise<EditableTextData[]> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : "";
  return adminFetch<EditableTextData[]>(`/admin/editable-texts${qs}`);
}
export function upsertEditableText(dto: UpsertEditableTextRequest): Promise<EditableTextData> {
  return adminFetch<EditableTextData>("/admin/editable-texts", { method: "PUT", body: JSON.stringify(dto) });
}
export function removeEditableText(key: string): Promise<{ ok: true }> {
  return adminFetch<{ ok: true }>(`/admin/editable-texts/${encodeURIComponent(key)}`, { method: "DELETE" });
}

export function listGlobalAcademy(opts?: { kind?: string }): Promise<GlobalAcademyContentData[]> {
  const qs = opts?.kind ? `?kind=${encodeURIComponent(opts.kind)}` : "";
  return adminFetch<GlobalAcademyContentData[]>(`/admin/global-academy${qs}`);
}
export function createGlobalAcademy(dto: UpsertGlobalAcademyContentRequest): Promise<GlobalAcademyContentData> {
  return adminFetch<GlobalAcademyContentData>("/admin/global-academy", { method: "POST", body: JSON.stringify(dto) });
}
export function updateGlobalAcademy(id: string, dto: UpsertGlobalAcademyContentRequest): Promise<GlobalAcademyContentData> {
  return adminFetch<GlobalAcademyContentData>(`/admin/global-academy/${id}`, { method: "PUT", body: JSON.stringify(dto) });
}
export function removeGlobalAcademy(id: string): Promise<{ ok: true }> {
  return adminFetch<{ ok: true }>(`/admin/global-academy/${id}`, { method: "DELETE" });
}

// ── Motor de Decisão CNAE/NR-1 ───────────────────────────────────────────────
export type CnaeRiskLevel = "BAIXO" | "BAIXO_MEDIO" | "MEDIO" | "MEDIO_ALTO" | "ALTO";

export interface CnaeDivisionRule {
  id: string;
  divisionCode: string;
  officialName: string;
  cnaeSection: string | null;
  preliminaryRiskLevel: CnaeRiskLevel;
  defaultMethod: "ESSENCIAL" | "ORGANIZACIONAL" | "INICIAL";
  defaultTechnicalOutput: string;
  pgrRequired: boolean;
  riskInventoryRequired: boolean;
  aepRequired: boolean;
  evidenceRequired: boolean;
  executiveReportRequired: boolean;
  actionPlanRequired: boolean;
  organizationalTriggerRules: string[] | null;
  technicalObservation: string | null;
  isActive: boolean;
}

export interface CnpjCompanyData {
  cnpj: string;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  situacaoCadastral: string | null;
  porte: string | null;
  cnaePrincipalCodigo: string | null;
  cnaePrincipalDescricao: string | null;
  cnaesSecundarios: { codigo: string; descricao: string | null }[];
  endereco: {
    logradouro: string | null;
    numero: string | null;
    bairro: string | null;
    municipio: string | null;
    uf: string | null;
    cep: string | null;
  };
  telefone: string | null;
  email: string | null;
  fonte: string;
}

export interface CnaeDecisionResult {
  empresa: string | null;
  cnpj: string | null;
  cnaePrincipalCodigo: string | null;
  cnaePrincipalDescricao: string | null;
  divisionCode: string | null;
  divisionName: string | null;
  preliminaryRiskLevel: CnaeRiskLevel | null;
  recommendedMethod: "ESSENCIAL" | "ORGANIZACIONAL" | null;
  technicalOutputs: string[];
  requiredDocuments: string[];
  requiredEvidences: string[];
  decisionScore: number;
  decisionReason: string;
  manualReviewRequired: boolean;
  warnings: string[];
  nextSteps: string[];
  criteriaConsidered: string[];
  isPreliminary: true;
  historyId?: string | null;
}

export interface CnaeEvaluationInputPayload {
  cnpj?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  cnaePrincipalCodigo?: string;
  cnaePrincipalDescricao?: string;
  cnaesSecundarios?: string[];
  situacaoCadastral?: string;
  porte?: string;
  numeroColaboradores?: number;
  possuiMultiplasUnidades?: boolean;
  possuiEquipeOperacional?: boolean;
  possuiTurnos?: boolean;
  possuiAtendimentoPublico?: boolean;
  possuiTrabalhoExterno?: boolean;
  possuiMetasComerciaisIntensas?: boolean;
  possuiHistoricoAfastamentos?: boolean;
  demandaNr1Completa?: boolean;
  observacoesDoConsultor?: string;
}

export interface CnaeDecisionHistoryItem {
  id: string;
  cnpj: string | null;
  divisionCode: string | null;
  recommendedMethod: string | null;
  riskLevel: string | null;
  manualReviewRequired: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  decisionResult: CnaeDecisionResult;
  createdAt: string;
}

export function consultCnpj(cnpj: string) {
  return adminFetch<{ ok: boolean; data?: CnpjCompanyData; error?: string }>("/cnpj/consult", {
    method: "POST",
    body: JSON.stringify({ cnpj }),
  });
}
export function evaluateFromCnpj(input: CnaeEvaluationInputPayload) {
  return adminFetch<{ ok: boolean; company: CnpjCompanyData | null; decision: CnaeDecisionResult }>(
    "/cnae-decision/from-cnpj",
    { method: "POST", body: JSON.stringify(input) },
  );
}
export function evaluateCnae(input: CnaeEvaluationInputPayload) {
  return adminFetch<CnaeDecisionResult>("/cnae-decision/evaluate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
export function listCnaeDivisions(filters: { risk?: string; method?: string; q?: string; active?: string } = {}) {
  const entries = Object.entries(filters).filter(([, v]) => v) as [string, string][];
  const qs = new URLSearchParams(entries).toString();
  return adminFetch<CnaeDivisionRule[]>(`/cnae-divisions${qs ? `?${qs}` : ""}`);
}
export function updateCnaeDivision(id: string, patch: Partial<CnaeDivisionRule>) {
  return adminFetch<CnaeDivisionRule>(`/cnae-divisions/${id}`, { method: "PUT", body: JSON.stringify(patch) });
}
export function listCnaeHistory(limit = 50) {
  return adminFetch<CnaeDecisionHistoryItem[]>(`/cnae-decision/history?limit=${limit}`);
}
export function reviewCnaeDecision(id: string, reviewNotes?: string) {
  return adminFetch<CnaeDecisionHistoryItem>(`/cnae-decision/history/${id}/review`, {
    method: "PATCH",
    body: JSON.stringify({ reviewNotes }),
  });
}

// ── Integrações (Clicksign/Asaas/Mercado Pago) + modelos de contrato ──
export type IntegrationProvider = "clicksign" | "asaas" | "mercadopago";

export interface IntegrationStatus {
  provider: IntegrationProvider;
  enabled: boolean;
  hasCredential: boolean;
  hint: string | null;
  sandbox: boolean;
}

export interface ContractTemplateSummary {
  id: string;
  name: string;
  fileName: string;
  mimeType: string;
  createdAt: string;
}

export function listIntegrations() {
  return adminFetch<IntegrationStatus[]>("/admin/integrations");
}

export function saveIntegration(
  provider: IntegrationProvider,
  body: { credential?: string; enabled?: boolean; sandbox?: boolean; purpose?: string; confirmProduction?: boolean },
) {
  return adminFetch<IntegrationStatus[]>(`/admin/integrations/${provider}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

/** Tela 07 [4] — testa a conexão da integração contra o provedor. */
export function testIntegration(provider: IntegrationProvider) {
  return adminFetch<{ ok: boolean; message: string }>(`/admin/integrations/${provider}/test`, {
    method: "POST",
  });
}

export function listContractTemplates() {
  return adminFetch<ContractTemplateSummary[]>("/admin/contract-templates");
}

export function uploadContractTemplate(body: { name: string; fileName: string; mimeType: string; data: string }) {
  return adminFetch<ContractTemplateSummary>("/admin/contract-templates", {
    method: "POST",
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });
}

export function deleteContractTemplate(id: string) {
  return adminFetch<{ ok: boolean }>(`/admin/contract-templates/${id}`, { method: "DELETE" });
}

export function sendForSignature(body: { name: string; email: string; templateId: string; message?: string }) {
  return adminFetch<{ ok: boolean; sentTo: string; documentKey: string }>("/admin/integrations/sign", {
    method: "POST",
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
}

export function createCharge(body: {
  provider: "asaas" | "mercadopago";
  name: string;
  email: string;
  cpfCnpj?: string;
  value: number;
  description?: string;
}) {
  return adminFetch<{ ok: boolean; url: string | null }>("/admin/integrations/charge", {
    method: "POST",
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });
}

// ── Metodologia configurável (Fase 1) ──
// Instrumento = slug do catálogo (motor dinâmico); built-in preservam o valor histórico.
export type MethodologyInstrument = string;
export type ScoreAggregation = "MEDIA_PONDERADA" | "MEDIA_SIMPLES" | "SOMA_NORMALIZADA";

export interface InstrumentSummary {
  id: string;
  slug: string;
  name: string;
  bandKind: MethodologyBandKind;
  aggregation: ScoreAggregation;
  description: string | null;
  active: boolean;
  builtIn: boolean;
  _count?: { versions: number };
}

export function listInstruments(): Promise<InstrumentSummary[]> {
  return adminFetch<InstrumentSummary[]>("/admin/instruments");
}
export function createInstrument(input: {
  slug: string; name: string; bandKind: MethodologyBandKind; aggregation: ScoreAggregation; description?: string | null;
}): Promise<InstrumentSummary> {
  return adminFetch<InstrumentSummary>("/admin/instruments", { method: "POST", body: JSON.stringify(input) });
}
export function updateInstrument(slug: string, input: {
  name?: string; bandKind?: MethodologyBandKind; aggregation?: ScoreAggregation; description?: string | null; active?: boolean;
}): Promise<InstrumentSummary> {
  return adminFetch<InstrumentSummary>(`/admin/instruments/${slug}`, { method: "PUT", body: JSON.stringify(input) });
}
export function deleteInstrument(slug: string): Promise<{ ok: true; deactivated: boolean }> {
  return adminFetch<{ ok: true; deactivated: boolean }>(`/admin/instruments/${slug}`, { method: "DELETE" });
}

// ── Motores CRIVO (Configuração do Motor · Evolução · Evidências) ──
export interface EngineOverview {
  enquadramento: { cnaeRules: number };
  diagnosticos: { instruments: number; activeMethodologies: number; responses: number };
  evolucao: { actions: number };
  evidencias: { total: number; approved: number };
}
export function getEngineOverview(): Promise<EngineOverview> {
  return adminFetch<EngineOverview>("/admin/engine/overview");
}

export interface EngineConfig {
  minRespondents: number;
  defaultAggregation: "MEDIA_PONDERADA" | "MEDIA_SIMPLES" | "SOMA_NORMALIZADA";
  defaultBandKind: "MATURITY" | "RISK";
  defaultScaleLabels: string[];
  updatedAt: string | null;
  floor: number;
  ceil: number;
}
export function getEngineConfig(): Promise<EngineConfig> {
  return adminFetch<EngineConfig>("/admin/engine/config");
}
export function saveEngineConfig(input: {
  minRespondents?: number;
  defaultAggregation?: EngineConfig["defaultAggregation"];
  defaultBandKind?: EngineConfig["defaultBandKind"];
  defaultScaleLabels?: string[];
}): Promise<EngineConfig> {
  return adminFetch<EngineConfig>("/admin/engine/config", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}
export interface EngineActionRow {
  id: string;
  action: string;
  point: string;
  tenantName: string;
  origin: string | null;
  planSource: string | null;
  responsible: string | null;
  dueDate: string | null;
  status: string;
  expectedEvidence: string | null;
  evidenceCount: number;
  riskLevel: string | null;
  overdue: boolean;
}
export function listEngineActions(params: { status?: string; withoutEvidence?: boolean; q?: string } = {}): Promise<{
  stats: { total: number; emAndamento: number; emRevisao: number; atrasadas: number; semEvidencia: number };
  rows: EngineActionRow[];
}> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.withoutEvidence) qs.set("withoutEvidence", "1");
  if (params.q) qs.set("q", params.q);
  const suffix = qs.toString() ? `?${qs}` : "";
  return adminFetch(`/admin/engine/actions${suffix}`);
}
export interface EngineEvidenceRow {
  id: string;
  kind: string;
  title: string;
  tenantName: string;
  linkedAction: string | null;
  author: string | null;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  hasFile: boolean;
}
export function listEngineEvidences(params: { status?: string; kind?: string } = {}): Promise<{
  stats: { total: number; aprovadas: number; pendentes: number; rejeitadas: number };
  rows: EngineEvidenceRow[];
}> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.kind) qs.set("kind", params.kind);
  const suffix = qs.toString() ? `?${qs}` : "";
  return adminFetch(`/admin/engine/evidences${suffix}`);
}
export function reviewEngineEvidence(id: string, action: "approve" | "reject" | "supersede", reason?: string): Promise<{ id: string; status: string }> {
  return adminFetch(`/admin/engine/evidences/${id}/review`, {
    method: "POST",
    body: JSON.stringify({ action, reason }),
  });
}

export interface DiagnosticLinkSummary {
  id: string;
  tenantId: string;
  tenantName: string;
  slug: string;
  active: boolean;
  respondents: number;
  createdAt: string;
}
export function ensureDiagnosticLink(tenantId: string, instrumentSlug: string): Promise<{ slug: string }> {
  return adminFetch<{ slug: string }>("/admin/diagnostics/links", {
    method: "POST",
    body: JSON.stringify({ tenantId, instrumentSlug }),
  });
}
export function listDiagnosticLinks(instrumentSlug: string): Promise<DiagnosticLinkSummary[]> {
  return adminFetch<DiagnosticLinkSummary[]>(`/admin/diagnostics/links?instrument=${encodeURIComponent(instrumentSlug)}`);
}
export function getDiagnosticResults(tenantId: string, instrumentSlug: string): Promise<{
  minRespondents: number;
  totalRespondents: number;
  suppressed: boolean;
  score?: number;
  level?: string;
  levelLabel?: string;
  byDimension?: Record<string, number>;
  dimensionLabels?: Record<string, string>;
  methodologyMixed?: boolean;
}> {
  return adminFetch(`/admin/diagnostics/results/${tenantId}/${encodeURIComponent(instrumentSlug)}`);
}
export type MethodologyStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type MethodologyBandKind = "MATURITY" | "RISK";

export interface MethodologyDimension {
  id?: string;
  parentSlug?: string | null;
  aggregation?: ScoreAggregation | null;
  slug: string;
  label: string;
  weight: number;
  order?: number;
}
export interface MethodologyQuestion {
  id?: string;
  dimensionSlug: string;
  text: string;
  weight: number;
  inverse: boolean;
  required?: boolean;
  order?: number;
}
export interface MethodologyBand {
  id?: string;
  kind: MethodologyBandKind;
  code: string;
  label: string;
  min: number;
  max: number;
  color?: string | null;
  order?: number;
}
export interface MethodologyVersion {
  id: string;
  instrument: MethodologyInstrument;
  version: number;
  label: string;
  status: MethodologyStatus;
  scaleLabels?: string[];
  notes?: string | null;
  createdAt: string;
  publishedAt?: string | null;
  dimensions: MethodologyDimension[];
  questions: MethodologyQuestion[];
  bands: MethodologyBand[];
}
export interface MethodologyVersionSummary {
  id: string;
  instrument: MethodologyInstrument;
  version: number;
  label: string;
  status: MethodologyStatus;
  createdAt: string;
  publishedAt?: string | null;
  _count: { dimensions: number; questions: number; bands: number };
}

export function getActiveMethodology(instrument: MethodologyInstrument) {
  return adminFetch<MethodologyVersion | null>(`/admin/methodology/instrument/${instrument}/active`);
}
export function listMethodologyVersions(instrument: MethodologyInstrument) {
  return adminFetch<MethodologyVersionSummary[]>(`/admin/methodology/instrument/${instrument}/versions`);
}
export function getMethodologyVersion(id: string) {
  return adminFetch<MethodologyVersion>(`/admin/methodology/version/${id}`);
}
export function createMethodologyDraft(instrument: MethodologyInstrument) {
  return adminFetch<MethodologyVersion>(`/admin/methodology/instrument/${instrument}/draft`, { method: "POST" });
}
export function updateMethodologyDraft(
  id: string,
  body: {
    label?: string;
    notes?: string;
    scaleLabels?: string[];
    dimensions?: Array<{ slug: string; label: string; weight?: number; parentSlug?: string | null; aggregation?: ScoreAggregation | null }>;
    questions?: Array<{ dimensionSlug: string; text: string; weight?: number; inverse?: boolean; required?: boolean }>;
    bands?: Array<{ kind: MethodologyBandKind; code: string; label: string; min: number; max: number; color?: string }>;
  },
) {
  return adminFetch<MethodologyVersion>(`/admin/methodology/version/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
export function publishMethodology(id: string) {
  return adminFetch<MethodologyVersion>(`/admin/methodology/version/${id}/publish`, { method: "POST" });
}
export function deleteMethodologyDraft(id: string) {
  return adminFetch<{ ok: boolean }>(`/admin/methodology/version/${id}`, { method: "DELETE" });
}

// ── Base CRIVO / Benchmarks (Fase 5) ──
export interface BenchmarkGroupData {
  group: string;
  count: number;
  suppressed: boolean;
  averages: Record<string, number>;
}
export interface BenchmarksData {
  minCount: number;
  totalRecords: number;
  totalCompanies: number;
  suppressedGroups: number;
  groups: BenchmarkGroupData[];
}
export function getBenchmarks(): Promise<BenchmarksData> {
  return adminFetch<BenchmarksData>("/admin/benchmarks");
}

// ── Inteligência CRIVO (Caderno §10) — camada analítica por cliente/CNPJ ──

export interface IntelligenceCompany {
  tenantId: string;
  organizationId: string;
  name: string;
  cnpj: string | null;
  status: string;
  headquarterType: string | null;
  groupId: string | null;
  groupName: string | null;
}

export interface IntelligenceOverview {
  company: {
    tenantId: string; organizationId: string; name: string; cnpj: string | null;
    status: string; headquarterType: string | null; internalResponsible: string | null;
    groupId: string | null; groupName: string | null;
  };
  contract:
    | { hasContract: true; status: string; byGroup: boolean; solutionIds: string[]; optionalModules: string[]; endDate: string | null }
    | { hasContract: false };
  modules: string[];
  period: { from: string | null; to: string | null } | null;
  cards: {
    protecao: { score: number | null; suppressed: boolean; respondents: number } | null;
    icd: { score: number | null; suppressed: boolean; eligibleLeaders: number; cyclesClosed: number } | null;
    plano: { total: number; concluidas: number; emAndamento: number; pct: number };
    nivelEvidencia: { totalAcoes: number; acoesComEvidencia: number; pct: number; evidenciasRegistradas: number; planosValidados: number };
    custos: { moderado: number | null; confidence: string | null } | null;
    pendencias: { acoesAtrasadas: number; acoesSemEvidencia: number; planosNaoValidados: number };
  };
  diagnostico: {
    psychosocial:
      | { respondents: number; suppressed: boolean; score: number | null; byDimension: Record<string, number>; methodologyVersionIds: string[]; methodologyMixed: boolean }
      | null;
  };
  planoEvidencias: {
    items: { point: string; action: string; status: string; responsible: string | null; dueDate: string | null; riskLevel: string | null; evidenceCount: number }[];
    evidenciasRegistradas: number;
  };
  lideranca: {
    icdCycles: { cycleName: string; score: number | null; suppressed: boolean; eligibleLeaders: number; distribution: unknown; computedAt: string }[];
    pocket: { total: number; completed: number };
  };
  custos: { scenarios: Record<string, number>; confidence: string; updatedAt: string } | null;
  peopleAnalytics: { period: string; values: Record<string, number | null>; alerts: number; analysisAt: string | null } | null;
  parecer: { title: string; publishedAt: string | null } | null;
  evolucao: { icd: { cycleName: string; score: number | null; computedAt: string }[] };
  baseCrivoBoundary: {
    consentBenchmark: boolean; consentCase: boolean; consentLogo: boolean; consentTestimonial: boolean; consentAnonymized: boolean;
  };
}

export function getIntelligenceCompanies(): Promise<IntelligenceCompany[]> {
  return adminFetch<IntelligenceCompany[]>("/admin/intelligence/companies");
}

export function getIntelligenceOverview(
  tenantId: string,
  params: { from?: string; to?: string } = {},
): Promise<IntelligenceOverview> {
  const q = new URLSearchParams();
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  const qs = q.toString();
  return adminFetch<IntelligenceOverview>(`/admin/intelligence/${tenantId}/overview${qs ? `?${qs}` : ""}`);
}
