/**
 * Cadastro de usuário × contextos do cliente (Spec V1 v1.2 §3). Usado pela
 * tela Usuários & Equipe (portal) e pelo modal de usuários da empresa (Super
 * Admin), para que as duas falem a mesma coisa e mandem o mesmo corpo.
 *
 * - Papel LIDER: só Minha Jornada. A API força isLeader=true, então o corpo
 *   NÃO leva isLeader (nunca um false) nem screenAccess (a checklist de telas
 *   é da Área da Organização e não se aplica a ele).
 * - Outro papel: Área da Organização; a caixa "Também é líder" acrescenta
 *   Minha Jornada (um login, dois contextos). isLeader vai sempre explícito.
 *
 * Função pura para caber no vitest de lib/ (sem DOM, sem Next).
 */
import { CLIENT_CONTEXT_LABEL, contextsFor } from '@crivo/types';

export const ALSO_LEADER_LABEL = 'Também é líder (acessa Minha Jornada)';
export const LIDER_ONLY_HINT = 'Líder: entra direto em Minha Jornada (sem Área da Organização)';

/** Ajuda da caixa "Também é líder" — `roleLabel` é o rótulo do papel (ex.: "Administrador"). */
export function alsoLeaderHint(roleLabel: string): string {
  return `Líder + ${roleLabel}: um login, dois contextos — Minha Jornada e Área da Organização.`;
}

/** Rótulos dos contextos do usuário, na ordem do seletor ("Minha Jornada", "Área da Organização"). */
export function contextLabelsFor(u: { role: string; isLeader?: boolean | null }): string[] {
  return contextsFor(u).map((c) => CLIENT_CONTEXT_LABEL[c]);
}

/** isLeader a enviar: omitido para o papel LIDER (a API o trata como sempre líder). */
export function leaderFlagFor(role: string, alsoLeader: boolean): boolean | undefined {
  return role === 'LIDER' ? undefined : alsoLeader;
}

export interface AcessoForm {
  role: string;
  /** Caixa "Também é líder" — só conta quando o papel não é LIDER. */
  alsoLeader: boolean;
  /** "Acesso a todas as telas da Área da Organização" (sem restrição). */
  allScreens: boolean;
  /** Telas marcadas. Pode trazer rotas que não estão mais na checklist (ex.: lider/pocket
   *  de cadastros antigos): elas seguem como estão — a tela não mostra, então não apaga. */
  screens: Iterable<string>;
  /** Rotas oferecidas pela checklist (telas da Área da Organização). */
  checklist: readonly string[];
}

export interface AcessoBody {
  isLeader?: boolean;
  screenAccess?: string[] | null;
}

/** Campos de liderança e telas do corpo de createUser/updateUser, ou o erro de validação. */
export function acessoBody(f: AcessoForm): { body: AcessoBody } | { error: string } {
  if (f.role === 'LIDER') return { body: {} };
  const screens = Array.from(f.screens);
  if (!f.allScreens && !screens.some((s) => f.checklist.includes(s))) {
    return { error: 'Selecione ao menos uma tela da Área da Organização ou marque “Acesso a todas”.' };
  }
  return { body: { isLeader: f.alsoLeader, screenAccess: f.allScreens ? null : screens } };
}
