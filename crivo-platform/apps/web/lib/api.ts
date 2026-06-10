// Base da API. Em produção vem de NEXT_PUBLIC_API_URL (injetada no build).
// Sem ela, falha de forma clara em vez de bater silenciosamente em localhost.
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
