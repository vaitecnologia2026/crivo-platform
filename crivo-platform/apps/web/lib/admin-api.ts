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
  Plan,
  PlatformLeadStage,
  PlatformLeadSummary,
  PlatformLoginResponse,
  PreliminaryReportData,
  ProductDetail,
  ProductSummary,
  ProvisionResult,
  TenantBrandingData,
  TenantDomainData,
  TenantModuleSummary,
  TenantSummary,
  UpdateBrandingRequest,
  UpdateMentoriaRequest,
  UpdateUserRequest,
  UserSummary,
  UpsertActionTemplateRequest,
  UpsertAiSettingsRequest,
  UpsertContractRequest,
  UpsertEditableTextRequest,
  UpsertGlobalAcademyContentRequest,
  UpsertProductRequest,
  UsageSummary,
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

export function getAuditLog(): Promise<AuditEntry[]> {
  return adminFetch<AuditEntry[]>("/admin/audit");
}

// ── CRM do super admin (funil comercial) ──

export function listLeads(): Promise<PlatformLeadSummary[]> {
  return adminFetch<PlatformLeadSummary[]>("/admin/leads");
}

export function setLeadStage(id: string, stage: PlatformLeadStage): Promise<PlatformLeadSummary> {
  return adminFetch<PlatformLeadSummary>(`/admin/leads/${id}/stage`, {
    method: "PATCH",
    body: JSON.stringify({ stage }),
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

/** #12 — Envia o acesso (login + senha) do cliente já convertido por e-mail. */
export function sendLeadAccess(
  id: string,
): Promise<{ sent: boolean; provider: string; to: string; tempPassword: string; reason?: string }> {
  return adminFetch(`/admin/leads/${id}/send-access`, { method: "POST" });
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

// ── Contrato por empresa (Briefing §11) ──

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
