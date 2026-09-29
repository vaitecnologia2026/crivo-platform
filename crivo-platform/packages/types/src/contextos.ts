// Contextos do cliente — Spec de Implementação V1 v1.2 §3 ("Papéis, login e
// contextos") + Diretriz de Integração SuperAdmin/Portal/Área do Líder §7 e §9.
//
// Um único login, dois contextos que NUNCA se misturam no mesmo menu:
//   - Minha Jornada (JORNADA): a experiência individual e privada do líder —
//     Pocket, Registro de Decisão, ICD próprio, Mentor e Academia.
//   - Área da Organização (ORGANIZACAO): o Portal corporativo.
//
//   Somente Líder (papel LIDER)          → só Minha Jornada.
//   Somente Administrador (papel corp.)  → só Área da Organização, sem acesso
//                                          ao conteúdo privado de líderes.
//   Líder + Administrador (papel corp.   → os dois, com seletor explícito.
//   marcado como líder)
//
// "Líder" é o papel LIDER OU a marcação `isLeader` do usuário — a acumulação
// de perfis só existe quando o mesmo usuário também tem papel corporativo
// explícito (Diretriz §9). Fonte ÚNICA da regra para a API e para o portal.

export const CLIENT_CONTEXTS = ['JORNADA', 'ORGANIZACAO'] as const;
export type ClientContext = (typeof CLIENT_CONTEXTS)[number];

export const CLIENT_CONTEXT_LABEL: Record<ClientContext, string> = {
  JORNADA: 'Minha Jornada',
  ORGANIZACAO: 'Área da Organização',
};

interface PapelEMarcacao {
  role: string;
  isLeader?: boolean | null;
}

/** Tem Minha Jornada: papel LIDER ou marcado como líder. */
export function isLeaderUser(u: PapelEMarcacao): boolean {
  return u.role === 'LIDER' || u.isLeader === true;
}

/**
 * Contextos a que o usuário tem direito, na ordem do seletor
 * ("Minha Jornada | Área da Organização"). Nunca vazio: todo papel que não é
 * LIDER tem a Área da Organização (com o que o papel e o contrato liberam).
 */
export function contextsFor(u: PapelEMarcacao): ClientContext[] {
  const out: ClientContext[] = [];
  if (isLeaderUser(u)) out.push('JORNADA');
  if (u.role !== 'LIDER') out.push('ORGANIZACAO');
  return out;
}

/**
 * Contexto em que o usuário entra: o último que ele escolheu, se ainda tiver
 * direito a ele; senão o primeiro disponível (Minha Jornada para quem é líder).
 */
export function initialContext(available: readonly ClientContext[], lembrado?: string | null): ClientContext {
  const salvo = available.find((c) => c === lembrado);
  return salvo ?? available[0] ?? 'ORGANIZACAO';
}

/** Resposta de GET /me/role. `isLeader`/`contexts` vêm do banco a cada chamada. */
export interface MyRoleData {
  role: string;
  name: string;
  mustChangePassword: boolean;
  isLeader: boolean;
  contexts: ClientContext[];
}
