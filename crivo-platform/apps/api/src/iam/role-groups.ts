import { isLeaderUser, type Role, type SessionUser } from '@crivo/types';

// Grupos de papéis usados nos @Roles das rotas do portal. Espelham as listas
// que já existiam escritas à mão (RH/GESTOR/CEO/ADMIN etc.) — nomeadas aqui
// para as rotas novas não divergirem. O LÍDER fica fora de todos: o dado dele é
// individual (Área do Líder) e a Diretriz de Integração §8 proíbe a empresa de
// ver dado individual — e o líder, dado corporativo — por URL, filtro ou API.

/** Gestão da empresa: atos formais (validar plano, abrir/fechar ciclo). */
export const GESTAO_EMPRESA: Role[] = ['RH', 'GESTOR', 'CEO', 'ADMIN'];

/** Gestão + Consultor CRIVO (acompanha o cliente e opera diagnóstico/plano). */
export const GESTAO_E_CONSULTORIA: Role[] = [...GESTAO_EMPRESA, 'CONSULTOR'];

/** Leitura de plano e documentos: gestão, consultoria e Jurídico. */
export const LEITURA_GESTAO: Role[] = [...GESTAO_E_CONSULTORIA, 'JURIDICO'];

/** Papéis que enxergam dados da empresa inteira (e não só os próprios). */
export function veEmpresaInteira(role: Role): boolean {
  return GESTAO_E_CONSULTORIA.includes(role);
}

/** Tem Minha Jornada (papel LIDER ou marcado como líder) — ver @crivo/types contextos. */
export function temJornada(user: Pick<SessionUser, 'role' | 'isLeader'>): boolean {
  return isLeaderUser(user);
}
