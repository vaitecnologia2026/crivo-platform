// Base da API. Em produção vem de NEXT_PUBLIC_API_URL (injetada no build).
// Sem ela, falha de forma clara em vez de bater silenciosamente em localhost.
import type {
  ActionItemData,
  ActionPlanData,
  CampaignSummary,
  CopilotoAskRequest,
  CopilotoAskResponse,
  CreateActionItemRequest,
  CreateActionPlanRequest,
  CreateCampaignRequest,
  DecisionData,
  DecisionInput,
  DecisionCategory,
  AffectedAudience,
  DecisionIcdData,
  CreatePocketSessionRequest,
  CreateEvidenceRequest,
  CreateEssentialRecordRequest,
  CreateLibraryItemRequest,
  DocumentDescriptor,
  LibraryItemData,
  EssentialRecordData,
  EvidenceData,
  GeneratedDocument,
  ParecerData,
  PocketReflectionData,
  PocketSessionData,
  PsychosocialQuestion,
  PsychosocialResult,
  PsychosocialDimension,
  PsychosocialRiskLevel,
  UserSummary,
  CreateUserRequest,
  UpdateUserRequest,
  CreateUserResult,
  UserSeats,
  OrganizationData,
  UpdateOrganizationRequest,
  SelfAssessmentData,
  SubmitSelfAssessmentRequest,
  TenantBrandingData,
  TermsStatus,
  UpdateActionItemRequest,
  UpdateCampaignRequest,
  UpdateLibraryItemRequest,
  UpsertParecerRequest,
  UpsertPocketReflectionRequest,
  InvisibleCostItem,
  InvisibleCostScenarios,
  PeoplePeriod,
  OperationalAlertsResult,
  GroupOverview,
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

/** Papel + nome do usuário logado (#51 — usado para HOME por papel). */
export function getMyRole(): Promise<{ role: string; name: string }> {
  return apiFetch<{ role: string; name: string }>('/me/role');
}

/** #68 — RBAC dinâmico: tenant-roles + usuários. */
export interface TenantRoleData {
  id: string;
  code: string;
  name: string;
  description: string | null;
  permissions: string[];
  isCustom: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface UserWithRoles {
  id: string;
  email: string;
  name: string;
  systemRole: string;
  customRoles: { id: string; name: string; code: string }[];
}

export function listTenantRoles(): Promise<TenantRoleData[]> {
  return apiFetch<TenantRoleData[]>('/tenant-roles');
}
export function listTenantUsers(): Promise<UserWithRoles[]> {
  return apiFetch<UserWithRoles[]>('/tenant-roles/users');
}
export function createTenantRole(dto: {
  code: string; name: string; description?: string; permissions: string[];
}): Promise<TenantRoleData> {
  return apiFetch<TenantRoleData>('/tenant-roles', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}
export function updateTenantRole(id: string, dto: {
  name?: string; description?: string | null; permissions?: string[]; active?: boolean;
}): Promise<TenantRoleData> {
  return apiFetch<TenantRoleData>(`/tenant-roles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });
}
export function removeTenantRole(id: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/tenant-roles/${id}`, { method: 'DELETE' });
}
export function assignTenantRole(roleId: string, userId: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/tenant-roles/${roleId}/users/${userId}`, { method: 'POST' });
}
export function unassignTenantRole(roleId: string, userId: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/tenant-roles/${roleId}/users/${userId}`, { method: 'DELETE' });
}

/** #65 — Onboarding checklist (5 marcos do primeiro uso). */
export interface OnboardingStatus {
  termsAccepted: boolean;
  firstDecisionRegistered: boolean;
  firstPocketCompleted: boolean;
  firstCampaignCreated: boolean;
  firstPlanValidated: boolean;
  allDone: boolean;
}
export function getMyOnboardingStatus(): Promise<OnboardingStatus> {
  return apiFetch<OnboardingStatus>('/me/onboarding-status');
}

/** #8/#10 — Tipo de diagnóstico do produto contratado + saídas técnicas. */
export interface DiagnosticContext {
  method: string | null;
  technicalOutputs: string[];
  productName: string | null;
}
export function getDiagnosticContext(): Promise<DiagnosticContext> {
  return apiFetch<DiagnosticContext>('/me/diagnostic-context');
}

/** #63 — People Analytics agregado do tenant. */
export interface AnalyticsData {
  icdEvolution: Array<{
    cycleName: string;
    quarter: number;
    year: number;
    score: number | null;
    suppressed: boolean;
    eligibleLeaders: number;
    closedAt: string | null;
  }>;
  decisionsByCategory: Array<{ category: string; count: number }>;
  decisionsByPressure: Array<{ pressureFactor: string; count: number }>;
  pocketUsage: { totalSessions: number; concluded: number; byMoment: Record<string, number> };
  planSummary: { total: number; byStatus: Record<string, number>; byOrigin: Record<string, number> };
}
export function getMyAnalytics(): Promise<AnalyticsData> {
  return apiFetch<AnalyticsData>('/me/analytics');
}

/** #62 — Catálogo global Academia CRIVO + importação para biblioteca do tenant. */
export interface GlobalAcademyLite {
  id: string;
  title: string;
  kind: string;
  description: string | null;
  url: string | null;
  category: string | null;
  tags: string[];
}
export function getMyGlobalAcademy(): Promise<GlobalAcademyLite[]> {
  return apiFetch<GlobalAcademyLite[]>('/me/global-academy');
}
export function importGlobalAcademyToLibrary(contentId: string): Promise<LibraryItemData> {
  return apiFetch<LibraryItemData>(`/library/import-global/${contentId}`, { method: 'POST' });
}

/** #61 — Catálogo de ações modelo (Biblioteca de Ações do Super Admin). */
export interface ActionTemplateLite {
  id: string;
  title: string;
  category: string;
  description: string | null;
  suggestedResponsible: string | null;
  expectedEvidence: string | null;
  defaultReviewDays: number;
}
export function getMyActionTemplates(): Promise<ActionTemplateLite[]> {
  return apiFetch<ActionTemplateLite[]>('/me/action-templates');
}

/** §8 — Ações sugeridas automaticamente pela tensão dominante do diagnóstico. */
export interface SuggestedActions {
  tension: string | null;
  reason: string;
  templates: ActionTemplateLite[];
}
export function getSuggestedActions(): Promise<SuggestedActions> {
  return apiFetch<SuggestedActions>('/action-plans/suggested-actions');
}
export function addActionItemFromTemplate(planId: string, templateId: string): Promise<ActionItemData> {
  return apiFetch<ActionItemData>(`/action-plans/${planId}/items-from-template/${templateId}`, {
    method: 'POST',
  });
}

/** #59 — Mentorias do tenant. Líder vê só as suas; RH/CEO veem todas. */
export interface MentoriaTenantEntry {
  id: string;
  title: string;
  format: string;
  mentorName: string;
  attendee: string;
  scheduledAt: string;
  durationMin: number;
  meetingUrl: string | null;
  location: string | null;
  status: string;
  notes: string | null;
  recordingUrl: string | null;
}
export function getMyMentorias(): Promise<MentoriaTenantEntry[]> {
  return apiFetch<MentoriaTenantEntry[]>('/me/mentorias');
}

/** F3 — Consolidado do Grupo Empresarial do usuário logado (403 se sem acesso). */
export function getMyGroupOverview(): Promise<GroupOverview> {
  return apiFetch<GroupOverview>('/me/group/overview');
}

/** #56 — Audit log do tenant (últimos 100 eventos). Filtra por tenantId no backend. */
export interface AuditLogEntry {
  id: string;
  action: string;
  target: string | null;
  actorEmail: string | null;
  at: string;
}
export function getMyAuditLog(): Promise<AuditLogEntry[]> {
  return apiFetch<AuditLogEntry[]>('/me/audit-log');
}

/** #56 — Troca de senha do próprio usuário (exige senha atual). */
export function changeMyPassword(currentPassword: string, newPassword: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>('/auth/password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

/** Identidade visual (white-label) da empresa do usuário logado. */
export function getMyBranding(): Promise<TenantBrandingData> {
  return apiFetch<TenantBrandingData>('/me/branding');
}
/** Salva a identidade visual (self-service, exige branding:edit). */
export function updateMyBranding(dto: Partial<TenantBrandingData>): Promise<TenantBrandingData> {
  return apiFetch<TenantBrandingData>('/me/branding', { method: 'PUT', body: JSON.stringify(dto) });
}

// ── Organização (dados cadastrais + plano — autoatendimento) ──
export function getMyOrganization(): Promise<OrganizationData> {
  return apiFetch<OrganizationData>('/me/organization');
}
export function updateMyOrganization(dto: UpdateOrganizationRequest): Promise<OrganizationData> {
  return apiFetch<OrganizationData>('/me/organization', { method: 'PUT', body: JSON.stringify(dto) });
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

/** §9 — Evidência por UPLOAD de arquivo (multipart). Não usa apiFetch (que força
 *  JSON); o browser define o boundary do multipart. */
export async function uploadEvidence(
  itemId: string,
  file: File,
  meta: { kind: string; title: string; note?: string },
): Promise<EvidenceData> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('kind', meta.kind);
  fd.append('title', meta.title);
  if (meta.note) fd.append('note', meta.note);
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${apiBase()}/action-plans/items/${itemId}/evidences/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
      signal: AbortSignal.timeout(60000),
    });
  } catch {
    throw new Error('Falha no upload. Verifique sua conexão e tente novamente.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'Falha no upload');
  }
  return res.json() as Promise<EvidenceData>;
}

/** §9 — Baixa o arquivo de uma evidência (autenticado) e dispara o download. */
export async function downloadEvidenceFile(id: string, fileName: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${apiBase()}/action-plans/evidences/${id}/file`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Falha ao baixar o arquivo');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Documentos (Briefing §15) ──

export function listDocuments(): Promise<DocumentDescriptor[]> {
  return apiFetch<DocumentDescriptor[]>('/action-plans/documents');
}
export function generateDocument(type: string): Promise<GeneratedDocument> {
  return apiFetch<GeneratedDocument>(`/action-plans/documents/${type}`);
}

// ── Emissões oficiais (Motor 4 — R-001): versão congelada + numerada ──

export interface ReportEmissionMeta {
  id: string;
  type: string;
  title: string;
  emissionNumber: number;
  method: string | null;
  technicalOutput: string | null;
  contentHash: string;
  status: string; // EMITIDA | REVISADA
  generatedBy: string | null;
  createdAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
}
export function listReportEmissions(): Promise<ReportEmissionMeta[]> {
  return apiFetch<ReportEmissionMeta[]>('/action-plans/documents/emissions');
}
export function getReportEmission(id: string): Promise<ReportEmissionMeta & { content: GeneratedDocument }> {
  return apiFetch(`/action-plans/documents/emissions/${id}`);
}
export function emitReportDocument(type: string): Promise<{ emission: ReportEmissionMeta & { content: GeneratedDocument }; reused: boolean }> {
  return apiFetch(`/action-plans/documents/${type}/emit`, { method: 'POST' });
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

// ── Campanhas de Diagnóstico (Portal §7 — editáveis pelo RH/CEO) ──

export function listCampaigns(sector?: string): Promise<CampaignSummary[]> {
  const qs = sector ? `?sector=${encodeURIComponent(sector)}` : '';
  return apiFetch<CampaignSummary[]>(`/icd/campaigns${qs}`);
}
export function createCampaign(dto: CreateCampaignRequest): Promise<{ id: string }> {
  return apiFetch<{ id: string }>('/icd/campaigns', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}
export function updateCampaign(id: string, dto: UpdateCampaignRequest): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/icd/campaigns/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });
}
export function closeCampaign(id: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/icd/campaigns/${id}/close`, { method: 'POST' });
}

/** #56 — Dispara lembretes por e-mail aos usuários que ainda não responderam. */
export function sendCampaignReminders(id: string): Promise<{ sent: number; pending: number; provider: string; reason?: string }> {
  return apiFetch<{ sent: number; pending: number; provider: string; reason?: string }>(
    `/icd/campaigns/${id}/send-reminders`,
    { method: 'POST' },
  );
}

// ── Pocket CRIVO (Anexo Técnico Pocket v1) — apoio reflexivo do líder ──

export function listMyPocketSessions(): Promise<PocketSessionData[]> {
  return apiFetch<PocketSessionData[]>('/pocket/sessions');
}
export function getPocketSession(id: string): Promise<PocketSessionData> {
  return apiFetch<PocketSessionData>(`/pocket/sessions/${id}`);
}
export function createPocketSession(dto: CreatePocketSessionRequest): Promise<PocketSessionData> {
  return apiFetch<PocketSessionData>('/pocket/sessions', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}
export function upsertPocketReflection(
  sessionId: string,
  dto: UpsertPocketReflectionRequest,
): Promise<PocketReflectionData> {
  return apiFetch<PocketReflectionData>(`/pocket/sessions/${sessionId}/reflections`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  });
}
export function completePocketSession(id: string): Promise<PocketSessionData> {
  return apiFetch<PocketSessionData>(`/pocket/sessions/${id}/complete`, { method: 'POST' });
}
export function removePocketSession(id: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/pocket/sessions/${id}`, { method: 'DELETE' });
}

// ── Questionário Psicossocial Organizacional (Briefing §6 — diagnóstico amplo) ──

type SectorAggregate = {
  sector: string;
  respondents: number;
  suppressed: boolean;
  score?: number;
  level?: PsychosocialRiskLevel;
  byDimension?: Record<PsychosocialDimension, number>;
  topRisk?: PsychosocialDimension;
};
export type PsychosocialResults = {
  minRespondents: number;
  totalRespondents: number;
  overall:
    | { suppressed: true }
    | {
        suppressed: false;
        score: number;
        level: PsychosocialRiskLevel;
        byDimension: Record<PsychosocialDimension, number>;
        topRisk: PsychosocialDimension;
      };
  sectors: SectorAggregate[];
};

export function getPsychosocialQuestions(): Promise<PsychosocialQuestion[]> {
  return apiFetch<PsychosocialQuestion[]>('/psychosocial/questions');
}
export function submitPsychosocial(dto: {
  sector?: string;
  answers: { questionId: number; value: number }[];
}): Promise<{ ok: true; result: PsychosocialResult }> {
  return apiFetch<{ ok: true; result: PsychosocialResult }>('/psychosocial/submit', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}
export function getPsychosocialResults(): Promise<PsychosocialResults> {
  return apiFetch<PsychosocialResults>('/psychosocial/results');
}

// ── Custos Invisíveis (Fase 2) ──
export interface InvisibleCostsData {
  items: InvisibleCostItem[];
  scenarios: InvisibleCostScenarios;
  confidence: string;
  notes: string | null;
  updatedAt: string | null;
  isDefault: boolean;
}
export function getInvisibleCosts(): Promise<InvisibleCostsData> {
  return apiFetch<InvisibleCostsData>('/invisible-costs');
}
export function saveInvisibleCosts(dto: {
  items: InvisibleCostItem[];
  scenarios: InvisibleCostScenarios;
  confidence?: string;
  notes?: string;
}): Promise<InvisibleCostsData> {
  return apiFetch<InvisibleCostsData>('/invisible-costs', { method: 'PUT', body: JSON.stringify(dto) });
}

// ── People Analytics (Fase 4) ──
export interface PeopleAnalysis {
  summary: string;
  alerts: string[];
  hypotheses: string[];
  recommendations: string[];
}
export interface PeopleIndicatorsData {
  periods: PeoplePeriod[];
  analysis: PeopleAnalysis | null;
  analysisAt: string | null;
  updatedAt: string | null;
}
export function getPeopleIndicators(): Promise<PeopleIndicatorsData> {
  return apiFetch<PeopleIndicatorsData>('/people-analytics');
}
export function savePeopleIndicators(periods: PeoplePeriod[]): Promise<PeopleIndicatorsData> {
  return apiFetch<PeopleIndicatorsData>('/people-analytics', { method: 'PUT', body: JSON.stringify({ periods }) });
}
export function analyzePeople(context?: string): Promise<{ analysis: PeopleAnalysis; analysisAt: string }> {
  return apiFetch<{ analysis: PeopleAnalysis; analysisAt: string }>('/people-analytics/analyze', {
    method: 'POST',
    body: JSON.stringify({ context }),
    signal: AbortSignal.timeout(60000),
  });
}

// ── Gestão de usuários / equipe (telas por usuário + limite por produto) ──

export function listUsers(): Promise<UserSummary[]> {
  return apiFetch<UserSummary[]>('/users');
}
export function getUserSeats(): Promise<UserSeats> {
  return apiFetch<UserSeats>('/users/seats');
}
export function createUser(dto: CreateUserRequest): Promise<CreateUserResult> {
  return apiFetch<CreateUserResult>('/users', { method: 'POST', body: JSON.stringify(dto) });
}
export function updateUser(id: string, dto: UpdateUserRequest): Promise<UserSummary> {
  return apiFetch<UserSummary>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(dto) });
}
/** Telas liberadas para o usuário logado (null = sem restrição) — filtra a nav. */
export function getMyScreens(): Promise<string[] | null> {
  return apiFetch<string[] | null>('/me/screens');
}
export function getPsychosocialLink(): Promise<{ slug: string | null }> {
  return apiFetch<{ slug: string | null }>('/psychosocial/link');
}
export function ensurePsychosocialLink(): Promise<{ slug: string }> {
  return apiFetch<{ slug: string }>('/psychosocial/link', { method: 'POST' });
}

// Endpoints PÚBLICOS (sem auth) — páginas anônimas /q/[slug] e /p/c/[slug].
/** Info pública de uma campanha de diagnóstico (link/QR sem login). Portal §7. */
export async function getPublicCampaign(slug: string): Promise<{
  name: string;
  description: string | null;
  sector: string | null;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  tenantName: string;
}> {
  const res = await fetch(`${apiBase()}/public/campaigns/${encodeURIComponent(slug)}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'Link inválido');
  }
  return res.json();
}
// ── Diagnósticos do catálogo (motor dinâmico) — link público /d/<slug> ──
export interface PublicDiagnosticInfo {
  tenantName: string;
  instrumentName: string;
  bandKind: 'MATURITY' | 'RISK';
  scaleLabels: string[] | null;
  questions: { id: number; dimension: string; text: string; required?: boolean }[];
}
export interface PublicDiagnosticResult {
  score: number;
  level: string;
  levelLabel?: string;
  byDimension: Record<string, number>;
  dimensionLabels: Record<string, string>;
  topAttention: string;
}
export async function getPublicDiagnostic(slug: string): Promise<PublicDiagnosticInfo> {
  const res = await fetch(`${apiBase()}/public/diagnostics/${encodeURIComponent(slug)}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'Link inválido');
  }
  return res.json();
}
export async function submitPublicDiagnostic(
  slug: string,
  body: { sector?: string; answers: { questionId: number; value: number }[] },
): Promise<{ ok: true; result: PublicDiagnosticResult }> {
  const res = await fetch(`${apiBase()}/public/diagnostics/${encodeURIComponent(slug)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'Falha ao enviar');
  }
  return res.json();
}

export async function getPublicPsychosocial(
  slug: string,
): Promise<{ tenantName: string; questions: PsychosocialQuestion[] }> {
  const res = await fetch(`${apiBase()}/public/psychosocial/${encodeURIComponent(slug)}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'Link inválido');
  }
  return res.json();
}
export async function submitPublicPsychosocial(
  slug: string,
  dto: { sector?: string; answers: { questionId: number; value: number }[] },
): Promise<{ ok: true; result: PsychosocialResult }> {
  const res = await fetch(`${apiBase()}/public/psychosocial/${encodeURIComponent(slug)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'Falha ao enviar');
  }
  return res.json();
}

// ── Registro de Decisões (Anexo ICD §5–§9) — front door dos 4 Eixos ──
export function listDecisions(): Promise<DecisionData[]> {
  return apiFetch<DecisionData[]>('/decisions');
}
export function createDecision(dto: DecisionInput): Promise<DecisionData> {
  return apiFetch<DecisionData>('/decisions', { method: 'POST', body: JSON.stringify(dto) });
}
export function listDecisionCategories(): Promise<DecisionCategory[]> {
  return apiFetch<DecisionCategory[]>('/decisions/categories');
}
export function listDecisionAudiences(): Promise<AffectedAudience[]> {
  return apiFetch<AffectedAudience[]>('/decisions/audiences');
}
/** Submete as 8 respostas P1–P8 → calcula e persiste o ICD da decisão (4 Eixos). */
export function submitDecisionIcd(
  decisionId: string,
  answers: { id: string; value: number }[],
): Promise<DecisionIcdData> {
  return apiFetch<DecisionIcdData>(`/decisions/${decisionId}/icd`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  });
}
/** ICD persistido de uma decisão (null se ainda não avaliada). */
export function getDecisionIcd(decisionId: string): Promise<DecisionIcdData | null> {
  return apiFetch<DecisionIcdData | null>(`/decisions/${decisionId}/icd`);
}

/**
 * Logout: revoga a sessão no servidor (incrementa a versão de token → invalida o
 * JWT) antes de limpar o token local. redirectOn401:false — se já expirou, no-op.
 */
export function logout(): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>('/auth/logout', { method: 'POST' }, { redirectOn401: false });
}

/** Notificações & Travas operacionais (§12) — derivadas do plano de ação. */
export function getOperationalAlerts(): Promise<OperationalAlertsResult> {
  return apiFetch<OperationalAlertsResult>('/alerts');
}
