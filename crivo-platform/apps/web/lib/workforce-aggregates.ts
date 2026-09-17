// Agregações PURAS do Workforce Intelligence (Super Admin › Módulos), feitas
// no cliente a partir dos WorkProcess / WorkTask que a API já devolve:
//   - por FUNÇÃO (aba "Vagas, Funções e Trabalho Real"): tarefas, taxa
//     automatizável e maior risco de cada `task.role`;
//   - por ÁREA (aba "Visão Executiva"): processos, cenário predominante,
//     maior risco e estágio mais avançado.
// Sem DOM nem React para caber no vitest de lib/. A "taxa automatizável" usa
// a MESMA regra da cobertura de IA do processo (aiPotential ≥ aiThresholdPct
// do processo da tarefa) — o limiar é informado pela empresa, não é score.
import type { WorkProcessData, WorkRisk, WorkTaskData, WorkTaskStage, WorkforceScenario } from "@crivo/types";

/** Do menor para o maior — "maior risco" é o último desta lista presente. */
export const RISK_ORDER: readonly WorkRisk[] = ["BAIXO", "MEDIO", "ALTO"];
/** Do menos ao mais avançado no fluxo cadastro → validação CRIVO → decisão. */
export const STAGE_ORDER: readonly WorkTaskStage[] = ["RASCUNHO", "EM_VALIDACAO_CRIVO", "VALIDADO_CRIVO", "DECIDIDO"];

/** Chave de agrupamento de rótulos livres (função, área): trim + minúsculas. */
export function chaveRotulo(s: string): string {
  return s.trim().toLowerCase();
}

export function maiorRisco(riscos: Iterable<WorkRisk>): WorkRisk | null {
  let melhor = -1;
  for (const r of riscos) melhor = Math.max(melhor, RISK_ORDER.indexOf(r));
  return melhor < 0 ? null : RISK_ORDER[melhor];
}

export function estagioMaisAvancado(estagios: Iterable<WorkTaskStage>): WorkTaskStage | null {
  let melhor = -1;
  for (const s of estagios) melhor = Math.max(melhor, STAGE_ORDER.indexOf(s));
  return melhor < 0 ? null : STAGE_ORDER[melhor];
}

/** Moda; empate resolvido pela ordem de primeira aparição. Vazio → null. */
export function cenarioPredominante(cenarios: Iterable<WorkforceScenario>): WorkforceScenario | null {
  const contagem = new Map<WorkforceScenario, number>();
  for (const c of cenarios) contagem.set(c, (contagem.get(c) ?? 0) + 1);
  let melhor: WorkforceScenario | null = null;
  let max = 0;
  for (const [c, n] of contagem) if (n > max) { melhor = c; max = n; }
  return melhor;
}

/** Tarefa conta como automatizável quando aiPotential ≥ limiar do SEU processo.
 *  Sem processo conhecido (limiar indefinido) a tarefa não conta — nunca se
 *  assume um limiar. */
export function tarefaAutomatizavel(task: Pick<WorkTaskData, "processId" | "aiPotential">, limiarPorProcesso: ReadonlyMap<string, number>): boolean {
  const limiar = limiarPorProcesso.get(task.processId);
  return limiar != null && task.aiPotential >= limiar;
}

/** % (inteiro) de tarefas automatizáveis pela regra acima. O denominador é só
 *  as tarefas cujo processo tem limiar conhecido — uma tarefa sem limiar não
 *  pode ser classificada, então não entra nem como "não automatizável".
 *  null quando nenhuma tarefa tem limiar conhecido. */
export function taxaAutomatizavelPct(tasks: ReadonlyArray<Pick<WorkTaskData, "processId" | "aiPotential">>, limiarPorProcesso: ReadonlyMap<string, number>): number | null {
  const classificaveis = tasks.filter((t) => limiarPorProcesso.has(t.processId));
  if (classificaveis.length === 0) return null;
  const n = classificaveis.filter((t) => tarefaAutomatizavel(t, limiarPorProcesso)).length;
  return Math.round((n / classificaveis.length) * 100);
}

export function limiaresPorProcesso(processos: ReadonlyArray<Pick<WorkProcessData, "id" | "aiThresholdPct">>): Map<string, number> {
  return new Map(processos.map((p) => [p.id, p.aiThresholdPct]));
}

export interface FuncaoAgregada {
  /** Primeiro rótulo original visto para a chave (trim+lowercase). */
  funcao: string;
  tarefas: number;
  /** null quando nenhuma tarefa tem processo com limiar conhecido. */
  taxaAutomatizavelPct: number | null;
  risco: WorkRisk | null;
}

/** Agrupa tarefas por `role`; ordena por nº de tarefas desc e nome asc.
 *  Tarefas com `role` vazio (só espaços) ficam fora — não há função a exibir. */
export function agregarPorFuncao(
  tasks: ReadonlyArray<Pick<WorkTaskData, "role" | "processId" | "aiPotential" | "risk">>,
  processos: ReadonlyArray<Pick<WorkProcessData, "id" | "aiThresholdPct">>,
): FuncaoAgregada[] {
  const limiares = limiaresPorProcesso(processos);
  const grupos = new Map<string, { funcao: string; itens: typeof tasks[number][] }>();
  for (const t of tasks) {
    const k = chaveRotulo(t.role);
    if (!k) continue;
    const g = grupos.get(k);
    if (g) g.itens.push(t);
    else grupos.set(k, { funcao: t.role.trim(), itens: [t] });
  }
  return [...grupos.values()]
    .map(({ funcao, itens }) => ({
      funcao,
      tarefas: itens.length,
      // null quando nenhuma tarefa da função tem limiar conhecido (regra da própria taxa).
      taxaAutomatizavelPct: taxaAutomatizavelPct(itens, limiares),
      risco: maiorRisco(itens.map((t) => t.risk)),
    }))
    .sort((a, b) => b.tarefas - a.tarefas || a.funcao.localeCompare(b.funcao, "pt-BR"));
}

export interface AreaAgregada {
  /** Primeiro rótulo original visto para a chave (trim+lowercase). */
  area: string;
  processos: number;
  tarefas: number;
  /** Moda do cenário das tarefas da área; sem tarefas, moda do dominantScenario dos processos. */
  cenario: WorkforceScenario | null;
  risco: WorkRisk | null;
  /** Estágio mais avançado entre as tarefas da área; null sem tarefas. */
  estagio: WorkTaskStage | null;
}

/** Agrupa processos por `area` e liga cada tarefa ao SEU processo (processId),
 *  para que a área da linha seja sempre a do processo. Tarefas cujo processo
 *  não está na lista são ignoradas (não há área confiável para elas). */
export function agregarPorArea(
  processos: ReadonlyArray<Pick<WorkProcessData, "id" | "area" | "dominantScenario" | "highestRisk">>,
  tasks: ReadonlyArray<Pick<WorkTaskData, "processId" | "scenario" | "risk" | "stage">>,
): AreaAgregada[] {
  const areaDoProcesso = new Map<string, string>();
  const grupos = new Map<string, { area: string; procs: typeof processos[number][]; itens: typeof tasks[number][] }>();
  for (const p of processos) {
    const k = chaveRotulo(p.area);
    areaDoProcesso.set(p.id, k);
    const g = grupos.get(k);
    if (g) g.procs.push(p);
    else grupos.set(k, { area: p.area.trim(), procs: [p], itens: [] });
  }
  for (const t of tasks) {
    const k = areaDoProcesso.get(t.processId);
    if (k) grupos.get(k)!.itens.push(t);
  }
  return [...grupos.values()]
    .map(({ area, procs, itens }) => ({
      area,
      processos: procs.length,
      tarefas: itens.length,
      cenario: itens.length
        ? cenarioPredominante(itens.map((t) => t.scenario))
        : cenarioPredominante(procs.flatMap((p) => (p.dominantScenario ? [p.dominantScenario] : []))),
      risco: itens.length ? maiorRisco(itens.map((t) => t.risk)) : maiorRisco(procs.flatMap((p) => (p.highestRisk ? [p.highestRisk] : []))),
      estagio: estagioMaisAvancado(itens.map((t) => t.stage)),
    }))
    .sort((a, b) => a.area.localeCompare(b.area, "pt-BR"));
}

/** Média (inteira) de `durationMin` das tarefas que a informaram (> 0); null se nenhuma. */
export function tempoMedioPorTarefaMin(tasks: ReadonlyArray<Pick<WorkTaskData, "durationMin">>): number | null {
  const com = tasks.filter((t) => t.durationMin > 0);
  if (com.length === 0) return null;
  return Math.round(com.reduce((s, t) => s + t.durationMin, 0) / com.length);
}
