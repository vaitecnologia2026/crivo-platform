const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

export function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('crivo_token') : null;
}
export function setToken(t: string) {
  localStorage.setItem('crivo_token', t);
}
export function clearToken() {
  localStorage.removeItem('crivo_token');
}

/** fetch autenticado: anexa o Bearer token e trata 401 (redireciona ao login). */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 401) {
    clearToken();
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new Error('Sessão expirada');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'Erro na requisição');
  }
  return res.json() as Promise<T>;
}
