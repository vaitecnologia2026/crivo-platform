import { describe, expect, it } from 'vitest';

import {
  agregarPorArea,
  agregarPorFuncao,
  cenarioPredominante,
  estagioMaisAvancado,
  maiorRisco,
  taxaAutomatizavelPct,
  tempoMedioPorTarefaMin,
} from './workforce-aggregates';

const procs = [
  { id: 'p1', area: 'Financeiro', aiThresholdPct: 60, dominantScenario: 'COPILOTO' as const, highestRisk: 'MEDIO' as const },
  { id: 'p2', area: ' financeiro ', aiThresholdPct: 80, dominantScenario: 'AUTOMATIZAR_PARTE' as const, highestRisk: 'ALTO' as const },
  { id: 'p3', area: 'RH', aiThresholdPct: 50, dominantScenario: null, highestRisk: null },
];

const tasks = [
  { role: 'Analista Fiscal', processId: 'p1', aiPotential: 70, risk: 'BAIXO' as const, scenario: 'COPILOTO' as const, stage: 'RASCUNHO' as const, durationMin: 30 },
  { role: ' analista fiscal', processId: 'p1', aiPotential: 50, risk: 'MEDIO' as const, scenario: 'COPILOTO' as const, stage: 'VALIDADO_CRIVO' as const, durationMin: 0 },
  { role: 'Assistente', processId: 'p2', aiPotential: 80, risk: 'ALTO' as const, scenario: 'AUTOMATIZAR_PARTE' as const, stage: 'EM_VALIDACAO_CRIVO' as const, durationMin: 10 },
  { role: 'Assistente', processId: 'orfao', aiPotential: 99, risk: 'BAIXO' as const, scenario: 'CAPACITAR' as const, stage: 'DECIDIDO' as const, durationMin: 20 },
];

describe('primitivas', () => {
  it('maiorRisco segue BAIXO < MEDIO < ALTO e devolve null no vazio', () => {
    expect(maiorRisco(['BAIXO', 'ALTO', 'MEDIO'])).toBe('ALTO');
    expect(maiorRisco(['BAIXO', 'MEDIO'])).toBe('MEDIO');
    expect(maiorRisco([])).toBeNull();
  });
  it('estagioMaisAvancado segue a ordem do fluxo', () => {
    expect(estagioMaisAvancado(['RASCUNHO', 'VALIDADO_CRIVO', 'EM_VALIDACAO_CRIVO'])).toBe('VALIDADO_CRIVO');
    expect(estagioMaisAvancado([])).toBeNull();
  });
  it('cenarioPredominante é a moda; empate fica com o primeiro visto', () => {
    expect(cenarioPredominante(['COPILOTO', 'CAPACITAR', 'CAPACITAR'])).toBe('CAPACITAR');
    expect(cenarioPredominante(['COPILOTO', 'CAPACITAR'])).toBe('COPILOTO');
    expect(cenarioPredominante([])).toBeNull();
  });
  it('taxaAutomatizavelPct usa o limiar do processo da tarefa (≥) e ignora processo desconhecido', () => {
    const limiares = new Map([['p1', 60], ['p2', 80]]);
    expect(taxaAutomatizavelPct(tasks.slice(0, 3), limiares)).toBe(67); // 70≥60 sim, 50≥60 não, 80≥80 sim
    expect(taxaAutomatizavelPct([tasks[3]], limiares)).toBe(0);
    expect(taxaAutomatizavelPct([], limiares)).toBeNull();
  });
  it('tempoMedioPorTarefaMin ignora tarefas sem duração e devolve null se nenhuma tiver', () => {
    expect(tempoMedioPorTarefaMin(tasks)).toBe(20); // (30+10+20)/3
    expect(tempoMedioPorTarefaMin([{ durationMin: 0 }])).toBeNull();
    expect(tempoMedioPorTarefaMin([])).toBeNull();
  });
});

describe('agregarPorFuncao', () => {
  it('agrupa por trim+lowercase mantendo o primeiro rótulo, ordena por tarefas desc e calcula taxa/risco', () => {
    const r = agregarPorFuncao(tasks, procs);
    expect(r.map((x) => x.funcao)).toEqual(['Analista Fiscal', 'Assistente']);
    expect(r[0]).toEqual({ funcao: 'Analista Fiscal', tarefas: 2, taxaAutomatizavelPct: 50, risco: 'MEDIO' });
    // órfã (processo fora da lista) conta como tarefa mas não como automatizável
    expect(r[1]).toEqual({ funcao: 'Assistente', tarefas: 2, taxaAutomatizavelPct: 50, risco: 'ALTO' });
  });
  it('taxa fica null quando nenhuma tarefa da função tem limiar conhecido', () => {
    const r = agregarPorFuncao([tasks[3]], procs);
    expect(r[0].taxaAutomatizavelPct).toBeNull();
  });
  it('vazio → lista vazia', () => {
    expect(agregarPorFuncao([], procs)).toEqual([]);
  });
});

describe('agregarPorArea', () => {
  it('une áreas por trim+lowercase, liga tarefa pela área do processo e ignora órfãs', () => {
    const r = agregarPorArea(procs, tasks);
    expect(r.map((x) => x.area)).toEqual(['Financeiro', 'RH']);
    expect(r[0]).toEqual({ area: 'Financeiro', processos: 2, tarefas: 3, cenario: 'COPILOTO', risco: 'ALTO', estagio: 'VALIDADO_CRIVO' });
  });
  it('área sem tarefas cai no dominantScenario/highestRisk dos processos e estágio null', () => {
    const r = agregarPorArea(procs, []);
    const fin = r.find((x) => x.area === 'Financeiro')!;
    expect(fin.cenario).toBe('COPILOTO');
    expect(fin.risco).toBe('ALTO');
    expect(fin.estagio).toBeNull();
    const rh = r.find((x) => x.area === 'RH')!;
    expect(rh).toEqual({ area: 'RH', processos: 1, tarefas: 0, cenario: null, risco: null, estagio: null });
  });
});
