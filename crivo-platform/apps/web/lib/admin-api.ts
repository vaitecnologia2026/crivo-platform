// Cliente da API do CONTROL PLANE (super admin). Sessão SEPARADA da do tenant:
// token próprio (crivo_admin_token) e redirect para /superadm em 401 — para que
// as duas sessões (plataforma vs. painel global) nunca se misturem.
import type {
  ContractData,
  CreateTenantRequest,
  Plan,
  PlatformLeadStage,
  PlatformLeadSummary,
  PlatformLoginResponse,
  ProductDetail,
  ProductSummary,
  ProvisionResult,
  TenantBrandingData,
  TenantDomainData,
  TenantModuleSummary,
  TenantSummary,
  UpdateBrandingRequest,
  UpsertContractRequest,
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
