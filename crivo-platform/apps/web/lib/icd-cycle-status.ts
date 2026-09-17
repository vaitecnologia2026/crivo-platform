/**
 * Status de leitura de um ciclo trimestral do ICD (aba "Aplicações e Ciclos"
 * do Super Admin › Liderança). O modelo só persiste OPEN/CLOSED; "Programado"
 * é DERIVADO: ciclo aberto cujo início ainda não chegou. Função pura para
 * caber no vitest de lib/ (sem DOM, sem Next).
 */

export type IcdCycleStatusLabel = 'Programado' | 'Em andamento' | 'Fechado';

/** Só o que a derivação precisa — evita acoplar a lib ao pacote de tipos. */
export interface IcdCycleStatusInput {
  status: 'OPEN' | 'CLOSED';
  /** ISO 8601 (o mesmo `startsAt` de IcdCycleData). */
  startsAt: string;
}

/**
 * - CLOSED → "Fechado" (independe de datas: fechar congela o resultado).
 * - OPEN com `startsAt` no futuro (estritamente > `now`) → "Programado".
 * - OPEN com `startsAt` ≤ `now` → "Em andamento" (inclusive se `endsAt` já
 *   passou: enquanto ninguém fechar, o ciclo continua acumulando decisões).
 * - `startsAt` inválido num ciclo aberto → "Em andamento" (nunca esconde o
 *   botão de fechar por causa de uma data corrompida).
 */
export function cycleStatusLabel(cycle: IcdCycleStatusInput, now: Date = new Date()): IcdCycleStatusLabel {
  if (cycle.status === 'CLOSED') return 'Fechado';
  const start = new Date(cycle.startsAt).getTime();
  if (Number.isNaN(start)) return 'Em andamento';
  return start > now.getTime() ? 'Programado' : 'Em andamento';
}
