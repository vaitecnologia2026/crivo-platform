// Base da API. Em produção vem de NEXT_PUBLIC_API_URL (injetada no build).
// Sem ela, falha de forma clara em vez de bater silenciosamente em localhost.
import type {
  ActionItemData,
  ActionPlanData,
  CopilotoAskRequest,
  CopilotoAskResponse,
  CreateActionItemRequest,
  CreateActionPlanRequest,
  CreateEvidenceRequest,
  CreateEssentialRecordRequest,
  CreateLibraryItemRequest,
  DocumentDescriptor,
  LibraryItemData,
  EssentialRecordData,
  EvidenceData,
  GeneratedDocument,
  ParecerData,
  SelfAssessmentData,
  SubmitSelfAssessmentRequest,
  TenantBrandingData,
  TermsStatus,
  UpdateActionItemRequest,
  UpdateLibraryItemRequest,
  UpsertParecerRequest,
} from '@crivo/types';

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

function apiBase(): string {
  if (!API) {
    throw new Error(
      'NEXT_PUBLIC_API_URL não configurada. Defina a URL da API no ambiente (Vercel).',
    );
  }
  return API;
}

export function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('crivo_token') : null;
}
export function setToken(t: string) {
  localStorage.setItem('crivo_token', t);
}
export function clearToken() {
  localStorage.removeItem('crivo_token');
}

interface ApiOptions {
  /** Em 401, limpa a sessão e volta ao login. Desligue no próprio /auth/login
   *  (lá um 401 significa "credenciais inválidas", não "sessão expirada"). */
  redirectOn401?: boolean;
}

/** fetch autenticado: anexa o Bearer token, aplica timeout e trata 401. */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  { redirectOn401 = true }: ApiOptions = {},
): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${apiBase()}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
      signal: init.signal ?? AbortSignal.timeout(15000),
    });
  } catch {
    // Falha de rede ou timeout — não há resposta do servidor.
    throw new Error('Serviço indisponível. Verifique sua conexão e tente novamente.');
  }

  if (res.status === 401 && redirectOn401) {
    clearToken();
    if (typeof window !== 'undefined') window.location.href = '/';
    throw new Error('Sessão expirada');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'Erro na requisição');
  }
  return res.json() as Promise<T>;
}

/** Códigos dos módulos ativos da empresa do usuário logado (nav data-driven). */
export function getMyModules(): Promise<string[]> {
  return apiFetch<string[]>('/me/modules');
}

/** Permissões efetivas (modulo:acao) do papel do usuário logado. */
export function getMyPermissions(): Promise<string[]> {
  return apiFetch<string[]>('/me/permissions');
}

/** Identidade visual (white-label) da empresa do usuário logado. */
export function getMyBranding(): Promise<TenantBrandingData> {
  return apiFetch<TenantBrandingData>('/me/branding');
}

// ── Aceite de termos/LGPD ──

export function getTerms(): Promise<TermsStatus> {
  return apiFetch<TermsStatus>('/me/terms');
}
export function acceptTerms(): Promise<TermsStatus> {
  return apiFetch<TermsStatus>('/me/terms/accept', { method: 'POST' });
}

// ── Academia CRIVO (biblioteca / CMS) ──

export function listLibrary(): Promise<LibraryItemData[]> {
  return apiFetch<LibraryItemData[]>('/library');
}
export function createLibraryItem(dto: CreateLibraryItemRequest): Promise<LibraryItemData> {
  return apiFetch<LibraryItemData>('/library', { method: 'POST', body: JSON.stringify(dto) });
}
export function updateLibraryItem(id: string, dto: UpdateLibraryItemRequest): Promise<LibraryItemData> {
  return apiFetch<LibraryItemData>(`/library/${id}`, { method: 'PUT', body: JSON.stringify(dto) });
}
export function removeLibraryItem(id: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/library/${id}`, { method: 'DELETE' });
}

// ── Plano de Ação + Evidências (Briefing §8/§9) ──

export function listActionPlans(): Promise<ActionPlanData[]> {
  return apiFetch<ActionPlanData[]>('/action-plans');
}
export function createActionPlan(dto: CreateActionPlanRequest): Promise<ActionPlanData> {
  return apiFetch<ActionPlanData>('/action-plans', { method: 'POST', body: JSON.stringify(dto) });
}
export function addActionItem(planId: string, dto: CreateActionItemRequest): Promise<ActionItemData> {
  return apiFetch<ActionItemData>(`/action-plans/${planId}/items`, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}
export function updateActionItem(itemId: string, dto: UpdateActionItemRequest): Promise<ActionItemData> {
  return apiFetch<ActionItemData>(`/action-plans/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });
}
export function removeActionItem(itemId: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/action-plans/items/${itemId}`, { method: 'DELETE' });
}
export function validateActionPlan(planId: string): Promise<ActionPlanData> {
  return apiFetch<ActionPlanData>(`/action-plans/${planId}/validate`, { method: 'POST' });
}
export function addEvidence(itemId: string, dto: CreateEvidenceRequest): Promise<EvidenceData> {
  return apiFetch<EvidenceData>(`/action-plans/items/${itemId}/evidences`, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

// ── Documentos (Briefing §15) ──

export function listDocuments(): Promise<DocumentDescriptor[]> {
  return apiFetch<DocumentDescriptor[]>('/action-plans/documents');
}
export function generateDocument(type: string): Promise<GeneratedDocument> {
  return apiFetch<GeneratedDocument>(`/action-plans/documents/${type}`);
}

// ── Parecer Consultivo CRIVO (Briefing §6 — autoria do consultor) ──

export function listPareceres(): Promise<ParecerData[]> {
  return apiFetch<ParecerData[]>('/parecer');
}
export function createParecer(dto: UpsertParecerRequest): Promise<ParecerData> {
  return apiFetch<ParecerData>('/parecer', { method: 'POST', body: JSON.stringify(dto) });
}
export function updateParecer(id: string, dto: UpsertParecerRequest): Promise<ParecerData> {
  return apiFetch<ParecerData>(`/parecer/${id}`, { method: 'PATCH', body: JSON.stringify(dto) });
}
export function publishParecer(id: string): Promise<ParecerData> {
  return apiFetch<ParecerData>(`/parecer/${id}/publish`, { method: 'POST' });
}
export function removeParecer(id: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/parecer/${id}`, { method: 'DELETE' });
}
export function generateParecerDocument(id: string): Promise<GeneratedDocument> {
  return apiFetch<GeneratedDocument>(`/parecer/${id}/document`);
}

// ── Copiloto CRIVO (Área do Líder — apoio reflexivo por IA) ──

export function askCopiloto(dto: CopilotoAskRequest): Promise<CopilotoAskResponse> {
  return apiFetch<CopilotoAskResponse>('/copiloto/ask', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

// ── Diagnóstico Essencial (Briefing §5) ──

export function getSelfAssessment(): Promise<SelfAssessmentData | null> {
  return apiFetch<SelfAssessmentData | null>('/essencial/self-assessment');
}
export function submitSelfAssessment(dto: SubmitSelfAssessmentRequest): Promise<SelfAssessmentData> {
  return apiFetch<SelfAssessmentData>('/essencial/self-assessment', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}
export function listEssentialRecords(): Promise<EssentialRecordData[]> {
  return apiFetch<EssentialRecordData[]>('/essencial/records');
}
export function createEssentialRecord(dto: CreateEssentialRecordRequest): Promise<EssentialRecordData> {
  return apiFetch<EssentialRecordData>('/essencial/records', { method: 'POST', body: JSON.stringify(dto) });
}
