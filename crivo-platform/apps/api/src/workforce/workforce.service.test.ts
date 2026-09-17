import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { WorkforceService } from './workforce.service';

/**
 * Workforce Intelligence — o que estes testes prendem são as REGRAS do
 * serviço, não a persistência: (1) a cobertura de IA de um processo é derivada
 * do limiar DO PROCESSO (editável), não de um número fixo no código; (2) a
 * decisão do cliente persiste quem/quando na tarefa, muda o estágio e audita
 * — e só acontece sobre tarefa já validada; (3) a validação CRIVO exige nota,
 * só age sobre a fila EM_VALIDACAO_CRIVO e muda o estágio (validar/devolver);
 * (4) o código T-NN é sequencial por empresa e nunca reaproveita número.
 */

const TENANT = 'org-1';
const CLIENTE = { id: 'user-1', name: 'Renata Dias', email: 'renata@empresa.com' };
const CRIVO = { id: 'adm-1', name: 'Consultor CRIVO', email: 'consultor@crivo.com' };

/** Prisma falso: `forTenant` entrega o mesmo `tx` para toda chamada. */
function prismaCom(tx: Record<string, unknown>) {
  const forTenant = vi.fn(async (_t: string, fn: (t: unknown) => Promise<unknown>) => fn(tx));
  return { forTenant, admin: {} };
}
const auditFalso = () => ({ record: vi.fn(async () => undefined) });

const AGORA = new Date('2026-09-16T12:00:00Z');
const tarefa = (extra: Record<string, unknown> = {}) => ({
  id: 't-1', code: 'T-01', processId: 'p-1', role: 'Analista Fiscal', area: 'Financeiro', name: 'Conciliação de notas',
  input: 'NFs', output: 'Relatório', volumePerMonth: 320, durationMin: 18, criticality: 'ALTA', aiPotential: 82,
  humanEssentiality: 40, risk: 'MEDIO', readiness: 58, scenario: 'COPILOTO',
  scenarioCurrent: null, scenarioAssisted: null, scenarioRedesigned: null,
  origin: 'RECOMENDACAO', stage: 'VALIDADO_CRIVO',
  validationNote: 'ok', validatedAt: AGORA, validatedByName: 'Consultor CRIVO', decision: null, decisionNote: null,
  decidedByUserId: null, decidedByName: null, decidedAt: null, createdAt: AGORA, updatedAt: AGORA,
  process: { name: 'Faturamento' },
  ...extra,
});

describe('WorkforceService.listProcesses — cobertura de IA por limiar da empresa', () => {
  const processo = (aiThresholdPct: number, potenciais: number[]) => ({
    id: 'p-1', name: 'Faturamento', area: 'Financeiro', unitId: null, aiThresholdPct, createdAt: AGORA, updatedAt: AGORA,
    tasks: potenciais.map((aiPotential, i) => ({ aiPotential, scenario: i % 2 ? 'COPILOTO' : 'AUTOMATIZAR_PARTE', risk: i === 0 ? 'ALTO' : 'BAIXO', stage: 'RASCUNHO' })),
  });
  const montar = (row: unknown) => new WorkforceService(prismaCom({ workProcess: { findMany: vi.fn(async () => [row]) } }) as never, auditFalso() as never);

  it('conta como coberta a tarefa com aiPotential ≥ aiThresholdPct DO PROCESSO', async () => {
    // Limiar 60: 82 e 60 entram, 55 e 30 não → 2 de 4 = 50%.
    const [p] = await montar(processo(60, [82, 60, 55, 30])).listProcesses(TENANT);
    expect(p.aiCoveragePct).toBe(50);
    expect(p.tasksCount).toBe(4);
  });

  it('mudar o limiar do processo muda a cobertura — nenhum 60 fixo no código', async () => {
    const [alto] = await montar(processo(85, [82, 60, 55, 30])).listProcesses(TENANT);
    expect(alto.aiCoveragePct).toBe(0);
    const [baixo] = await montar(processo(30, [82, 60, 55, 30])).listProcesses(TENANT);
    expect(baixo.aiCoveragePct).toBe(100);
  });

  it('processo sem tarefas não tem cobertura (null), cenário nem risco — nada inventado', async () => {
    const [p] = await montar(processo(60, [])).listProcesses(TENANT);
    expect(p.aiCoveragePct).toBeNull();
    expect(p.dominantScenario).toBeNull();
    expect(p.highestRisk).toBeNull();
  });

  it('agrega cenário predominante e maior risco a partir das tarefas', async () => {
    const [p] = await montar(processo(60, [82, 60, 55])).listProcesses(TENANT);
    // 2× AUTOMATIZAR_PARTE (índices 0 e 2) contra 1× COPILOTO; risco ALTO na primeira.
    expect(p.dominantScenario).toBe('AUTOMATIZAR_PARTE');
    expect(p.highestRisk).toBe('ALTO');
    expect(p.byStage.RASCUNHO).toBe(3);
  });
});

describe('WorkforceService.decideTask — decisão humana do cliente', () => {
  function montar(stage = 'VALIDADO_CRIVO') {
    const updated: Record<string, unknown>[] = [];
    const tx = {
      workTask: {
        findUnique: vi.fn(async () => tarefa({ stage })),
        update: vi.fn(async (args: { data: Record<string, unknown> }) => { updated.push(args.data); return tarefa({ stage, ...args.data }); }),
      },
    };
    const audit = auditFalso();
    const svc = new WorkforceService(prismaCom(tx) as never, audit as never);
    return { svc, tx, audit, updated };
  }

  it('persiste a decisão com QUEM e QUANDO na própria tarefa, muda o estágio e audita com o ator', async () => {
    const antes = Date.now();
    const { svc, updated, audit } = montar();
    const out = await svc.decideTask(TENANT, 't-1', { decision: 'CONDICIONAR', note: 'Revisão humana 100%.' }, CLIENTE);

    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({
      stage: 'DECIDIDO',
      decision: 'CONDICIONAR',
      decisionNote: 'Revisão humana 100%.',
      decidedByUserId: 'user-1',
      decidedByName: 'Renata Dias',
    });
    expect((updated[0].decidedAt as Date).getTime()).toBeGreaterThanOrEqual(antes);
    expect(out.decision).toBe('CONDICIONAR');
    expect(out.decidedByName).toBe('Renata Dias');

    expect(audit.record).toHaveBeenCalledTimes(1);
    const entry = (audit.record as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(entry).toMatchObject({
      action: 'workforce.task.decision',
      actor: { id: 'user-1', email: 'renata@empresa.com' },
      target: 'T-01',
      tenantId: TENANT,
      meta: { decision: 'CONDICIONAR', from: 'VALIDADO_CRIVO', to: 'DECIDIDO' },
    });
  });

  it('Aceitar/Rejeitar encerram em DECIDIDO; Devolver manda de volta à fila de validação CRIVO', async () => {
    for (const [decision, stage] of [['ACEITAR', 'DECIDIDO'], ['REJEITAR', 'DECIDIDO'], ['DEVOLVER', 'EM_VALIDACAO_CRIVO']] as const) {
      const { svc, updated } = montar();
      await svc.decideTask(TENANT, 't-1', { decision }, CLIENTE);
      expect(updated[0].stage).toBe(stage);
      expect(updated[0].decision).toBe(decision);
    }
  });

  it('nota é opcional (o protótipo decide com um clique); vazia vira null', async () => {
    const { svc, updated } = montar();
    await svc.decideTask(TENANT, 't-1', { decision: 'ACEITAR', note: '   ' }, CLIENTE);
    expect(updated[0].decisionNote).toBeNull();
  });

  it('tarefa ainda não validada pela CRIVO (RASCUNHO / EM_VALIDACAO_CRIVO) NÃO recebe decisão: 400 e nada gravado', async () => {
    for (const stage of ['RASCUNHO', 'EM_VALIDACAO_CRIVO']) {
      const { svc, updated, audit } = montar(stage);
      await expect(svc.decideTask(TENANT, 't-1', { decision: 'ACEITAR' }, CLIENTE)).rejects.toBeInstanceOf(BadRequestException);
      expect(updated).toHaveLength(0);
      expect(audit.record).not.toHaveBeenCalled();
    }
  });

  it('tarefa já DECIDIDA pode receber NOVA decisão (a anterior fica na auditoria)', async () => {
    const { svc, updated, audit } = montar('DECIDIDO');
    await svc.decideTask(TENANT, 't-1', { decision: 'REJEITAR' }, CLIENTE);
    expect(updated[0].decision).toBe('REJEITAR');
    expect(audit.record).toHaveBeenCalledTimes(1);
  });
});

describe('WorkforceService.validateTask — validação CRIVO', () => {
  function montar(stage = 'EM_VALIDACAO_CRIVO') {
    const updated: Record<string, unknown>[] = [];
    const tx = {
      workTask: {
        findUnique: vi.fn(async () => tarefa({ stage, decision: 'DEVOLVER', decidedByName: 'Renata Dias' })),
        update: vi.fn(async (args: { data: Record<string, unknown> }) => { updated.push(args.data); return tarefa({ stage, ...args.data }); }),
      },
    };
    const audit = auditFalso();
    const svc = new WorkforceService(prismaCom(tx) as never, audit as never);
    return { svc, audit, updated };
  }

  it('sem nota (vazia ou só espaço) não valida: 400 e NADA é gravado', async () => {
    const { svc, updated, audit } = montar();
    await expect(svc.validateTask(TENANT, 't-1', { note: '   ' }, CRIVO)).rejects.toBeInstanceOf(BadRequestException);
    expect(updated).toHaveLength(0);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('VALIDADO muda o estágio para VALIDADO_CRIVO com nota/quem/quando, limpa a decisão anterior e audita', async () => {
    const { svc, updated, audit } = montar();
    await svc.validateTask(TENANT, 't-1', { note: 'Cenário coerente com o volume observado.' }, CRIVO);
    expect(updated[0]).toMatchObject({
      stage: 'VALIDADO_CRIVO',
      validationNote: 'Cenário coerente com o volume observado.',
      validatedByName: 'Consultor CRIVO',
      decision: null,
      decidedByName: null,
    });
    expect(updated[0].validatedAt).toBeInstanceOf(Date);
    const entry = (audit.record as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(entry).toMatchObject({
      action: 'workforce.task.validate',
      actor: { id: 'adm-1', email: 'consultor@crivo.com' },
      target: 'T-01',
      tenantId: TENANT,
      meta: { result: 'VALIDADO', from: 'EM_VALIDACAO_CRIVO', to: 'VALIDADO_CRIVO' },
    });
  });

  it('DEVOLVIDO volta a RASCUNHO com a nota para quem cadastrou (sem data de validação)', async () => {
    const { svc, updated } = montar();
    await svc.validateTask(TENANT, 't-1', { result: 'DEVOLVIDO', note: 'Falta a saída da tarefa.' }, CRIVO);
    expect(updated[0]).toMatchObject({ stage: 'RASCUNHO', validationNote: 'Falta a saída da tarefa.', validatedAt: null, validatedByName: null });
  });

  it('só a fila EM_VALIDACAO_CRIVO é validável: RASCUNHO, VALIDADO_CRIVO e DECIDIDO dão 400', async () => {
    for (const stage of ['RASCUNHO', 'VALIDADO_CRIVO', 'DECIDIDO']) {
      const { svc, updated } = montar(stage);
      await expect(svc.validateTask(TENANT, 't-1', { note: 'x' }, CRIVO)).rejects.toBeInstanceOf(BadRequestException);
      expect(updated).toHaveLength(0);
    }
  });
});

describe('WorkforceService.updateTask — edição não valida nem decide', () => {
  it('editar uma tarefa VALIDADO_CRIVO preserva o estágio mesmo que o DTO peça RASCUNHO', async () => {
    let data: Record<string, unknown> = {};
    const tx = {
      workTask: {
        findUnique: vi.fn(async () => tarefa({ stage: 'VALIDADO_CRIVO' })),
        update: vi.fn(async (args: { data: Record<string, unknown> }) => { data = args.data; return tarefa({ stage: 'VALIDADO_CRIVO' }); }),
      },
      workProcess: { findUnique: vi.fn(async () => ({ id: 'p-1' })) },
    };
    const svc = new WorkforceService(prismaCom(tx) as never, auditFalso() as never);
    await svc.updateTask(TENANT, 't-1', {
      processId: 'p-1', role: 'Analista', area: 'Financeiro', name: 'Conciliação', input: 'NFs', output: 'Relatório',
      volumePerMonth: 1, durationMin: 1, criticality: 'ALTA', aiPotential: 50, humanEssentiality: 50, risk: 'BAIXO', readiness: 50,
      scenario: 'COPILOTO', origin: 'FATO', stage: 'RASCUNHO',
    });
    expect(data.stage).toBe('VALIDADO_CRIVO');
    // A edição nunca mexe em decisão/validação: só nos campos do trabalho.
    expect(data).not.toHaveProperty('decision');
    expect(data).not.toHaveProperty('validatedAt');
  });

  it('em RASCUNHO a edição pode enviar para a fila EM_VALIDACAO_CRIVO', async () => {
    let data: Record<string, unknown> = {};
    const tx = {
      workTask: {
        findUnique: vi.fn(async () => tarefa({ stage: 'RASCUNHO' })),
        update: vi.fn(async (args: { data: Record<string, unknown> }) => { data = args.data; return tarefa({ stage: 'EM_VALIDACAO_CRIVO' }); }),
      },
    };
    const svc = new WorkforceService(prismaCom(tx) as never, auditFalso() as never);
    await svc.updateTask(TENANT, 't-1', {
      processId: 'p-1', role: 'Analista', area: 'Financeiro', name: 'Conciliação', input: 'NFs', output: 'Relatório',
      volumePerMonth: 1, durationMin: 1, criticality: 'ALTA', aiPotential: 50, humanEssentiality: 50, risk: 'BAIXO', readiness: 50,
      scenario: 'COPILOTO', origin: 'FATO', stage: 'EM_VALIDACAO_CRIVO',
    });
    expect(data.stage).toBe('EM_VALIDACAO_CRIVO');
  });
});

describe('WorkforceService.createTask — código T-NN por empresa', () => {
  function montar(codigos: string[]) {
    let data: Record<string, unknown> = {};
    const tx = {
      workProcess: { findUnique: vi.fn(async () => ({ id: 'p-1' })) },
      workTask: {
        findMany: vi.fn(async () => codigos.map((code) => ({ code }))),
        create: vi.fn(async (args: { data: Record<string, unknown> }) => { data = args.data; return tarefa({ ...args.data }); }),
      },
    };
    const svc = new WorkforceService(prismaCom(tx) as never, auditFalso() as never);
    return { svc, data: () => data };
  }
  const dto = {
    processId: 'p-1', role: 'Analista', area: 'Financeiro', name: 'Conciliação', input: 'NFs', output: 'Relatório',
    volumePerMonth: 1, durationMin: 1, criticality: 'ALTA', aiPotential: 50, humanEssentiality: 50, risk: 'BAIXO', readiness: 50,
    scenario: 'COPILOTO', origin: 'FATO',
  } as const;

  it('primeira tarefa da empresa é T-01 e nasce em RASCUNHO com o tenant da chamada', async () => {
    const { svc, data } = montar([]);
    await svc.createTask(TENANT, dto);
    expect(data()).toMatchObject({ code: 'T-01', stage: 'RASCUNHO', tenantId: TENANT });
  });

  it('usa maior número + 1 (buraco por exclusão não é reaproveitado)', async () => {
    const { svc, data } = montar(['T-01', 'T-03', 'T-07']);
    await svc.createTask(TENANT, dto);
    expect(data().code).toBe('T-08');
  });
});

describe('WorkforceService — cenários narrativos (scenarioCurrent/Assisted/Redesigned)', () => {
  // Aba "Cenários Pessoa × Processo × IA": as 3 narrativas de transição por
  // tarefa (gap da auditoria Programas vs. protótipo Lovable, 17/09) precisam
  // ir e voltar pela API tal como os demais campos da tarefa.
  const dto = {
    processId: 'p-1', role: 'Analista', area: 'Financeiro', name: 'Conciliação', input: 'NFs', output: 'Relatório',
    volumePerMonth: 1, durationMin: 1, criticality: 'ALTA', aiPotential: 50, humanEssentiality: 50, risk: 'BAIXO', readiness: 50,
    scenario: 'COPILOTO', origin: 'FATO',
    scenarioCurrent: 'Conferência manual em planilha.',
    scenarioAssisted: 'Motor de anomalias sugere itens a revisar.',
    scenarioRedesigned: 'Analista revisa apenas exceções sinalizadas.',
  } as const;

  it('createTask grava as 3 narrativas (trim) e a tarefa criada as devolve', async () => {
    let data: Record<string, unknown> = {};
    const tx = {
      workProcess: { findUnique: vi.fn(async () => ({ id: 'p-1' })) },
      workTask: {
        findMany: vi.fn(async () => []),
        create: vi.fn(async (args: { data: Record<string, unknown> }) => { data = args.data; return tarefa({ ...args.data }); }),
      },
    };
    const svc = new WorkforceService(prismaCom(tx) as never, auditFalso() as never);
    const criada = await svc.createTask(TENANT, { ...dto, scenarioCurrent: '  Conferência manual em planilha.  ' });

    expect(data).toMatchObject({
      scenarioCurrent: 'Conferência manual em planilha.',
      scenarioAssisted: 'Motor de anomalias sugere itens a revisar.',
      scenarioRedesigned: 'Analista revisa apenas exceções sinalizadas.',
    });
    expect(criada.scenarioCurrent).toBe('Conferência manual em planilha.');
    expect(criada.scenarioAssisted).toBe('Motor de anomalias sugere itens a revisar.');
    expect(criada.scenarioRedesigned).toBe('Analista revisa apenas exceções sinalizadas.');
  });

  it('updateTask atualiza as narrativas de uma tarefa existente e as lê de volta', async () => {
    let data: Record<string, unknown> = {};
    const tx = {
      workTask: {
        findUnique: vi.fn(async () => tarefa({ stage: 'RASCUNHO', scenarioCurrent: null, scenarioAssisted: null, scenarioRedesigned: null })),
        update: vi.fn(async (args: { data: Record<string, unknown> }) => { data = args.data; return tarefa({ stage: 'RASCUNHO', ...args.data }); }),
      },
    };
    const svc = new WorkforceService(prismaCom(tx) as never, auditFalso() as never);
    const atualizada = await svc.updateTask(TENANT, 't-1', dto);

    expect(data).toMatchObject({
      scenarioCurrent: 'Conferência manual em planilha.',
      scenarioAssisted: 'Motor de anomalias sugere itens a revisar.',
      scenarioRedesigned: 'Analista revisa apenas exceções sinalizadas.',
    });
    expect(atualizada.scenarioCurrent).toBe('Conferência manual em planilha.');
    expect(atualizada.scenarioAssisted).toBe('Motor de anomalias sugere itens a revisar.');
    expect(atualizada.scenarioRedesigned).toBe('Analista revisa apenas exceções sinalizadas.');
  });

  it('narrativa ausente ou só espaço vira null (campo opcional, não obrigatório)', async () => {
    let data: Record<string, unknown> = {};
    const tx = {
      workTask: {
        findUnique: vi.fn(async () => tarefa({ stage: 'RASCUNHO' })),
        update: vi.fn(async (args: { data: Record<string, unknown> }) => { data = args.data; return tarefa({ stage: 'RASCUNHO', ...args.data }); }),
      },
    };
    const svc = new WorkforceService(prismaCom(tx) as never, auditFalso() as never);
    await svc.updateTask(TENANT, 't-1', { ...dto, scenarioCurrent: '   ', scenarioAssisted: undefined, scenarioRedesigned: null });

    expect(data.scenarioCurrent).toBeNull();
    expect(data.scenarioAssisted).toBeNull();
    expect(data.scenarioRedesigned).toBeNull();
  });
});

describe('WorkforceService.summary — contagens reais', () => {
  it('conta por estágio, risco, cenário e decisão a partir das tarefas; pilotos em andamento pelo status', async () => {
    const tx = {
      workProcess: { count: vi.fn(async () => 2) },
      workTask: {
        findMany: vi.fn(async () => [
          // roles: 'Analista fiscal' e ' analista FISCAL ' são a MESMA função (normalização) → 2 distintas com 'Gerente'.
          { stage: 'RASCUNHO', risk: 'ALTO', scenario: 'COPILOTO', decision: null, area: 'Financeiro', role: 'Analista fiscal' },
          { stage: 'EM_VALIDACAO_CRIVO', risk: 'BAIXO', scenario: 'COPILOTO', decision: null, area: 'Pessoas', role: ' analista FISCAL ' },
          { stage: 'DECIDIDO', risk: 'MEDIO', scenario: 'MANTER_HUMANO', decision: 'ACEITAR', area: 'Pessoas', role: 'Gerente' },
        ]),
      },
      workSkill: { count: vi.fn(async () => 5) },
      workPilot: { findMany: vi.fn(async () => [{ status: 'EM_ANDAMENTO', kind: 'PILOTO' }, { status: 'CONCLUIDO', kind: 'PILOTO' }, { status: 'EM_ANDAMENTO', kind: 'BLUEPRINT' }, { status: 'APROVADO', kind: 'BLUEPRINT' }, { status: 'APROVADO', kind: 'PILOTO' }]) },
    };
    const svc = new WorkforceService(prismaCom(tx) as never, auditFalso() as never);
    const s = await svc.summary(TENANT);
    // approvedBlueprints conta só kind BLUEPRINT + APROVADO (o piloto APROVADO não entra); roles = funções distintas normalizadas.
    // inProgress/concluded contam só PILOTO (o blueprint EM_ANDAMENTO fica fora).
    expect(s).toMatchObject({ processes: 2, tasks: 3, skills: 5, roles: 2, pilots: { total: 5, inProgress: 1, concluded: 1, blueprints: 2, approvedBlueprints: 1 } });
    expect(s.byStage).toMatchObject({ RASCUNHO: 1, EM_VALIDACAO_CRIVO: 1, VALIDADO_CRIVO: 0, DECIDIDO: 1 });
    expect(s.byRisk).toMatchObject({ ALTO: 1, MEDIO: 1, BAIXO: 1 });
    expect(s.byScenario.COPILOTO).toBe(2);
    expect(s.byDecision).toMatchObject({ ACEITAR: 1, CONDICIONAR: 0, DEVOLVER: 0, REJEITAR: 0 });
    expect(s.areas).toEqual(['Financeiro', 'Pessoas']);
  });
});

describe('WorkforceService.updatePilot/createPilot — status do blueprint decidido pelo cliente deixa rastro', () => {
  const piloto = (extra: Record<string, unknown> = {}) => ({
    id: 'bp-1', processId: null, kind: 'BLUEPRINT', name: 'Blueprint N1', baseline: 'b', indicator: 'i', result: '',
    confidence: 'MEDIA', status: 'EM_REVISAO', effort: null, potentialValue: null, partner: null,
    createdAt: AGORA, updatedAt: AGORA, process: null, ...extra,
  });
  function montar(statusAtual = 'EM_REVISAO') {
    const tx = {
      workPilot: {
        findUnique: vi.fn(async () => piloto({ status: statusAtual })),
        update: vi.fn(async (args: { data: Record<string, unknown> }) => piloto({ status: statusAtual, ...args.data })),
        create: vi.fn(async (args: { data: Record<string, unknown> }) => piloto(args.data)),
      },
    };
    const audit = auditFalso();
    const svc = new WorkforceService(prismaCom(tx) as never, audit as never);
    return { svc, audit };
  }

  it('cliente (portal, com ator) aprova: audita workforce.pilot.status com from/to e quem', async () => {
    const { svc, audit } = montar('EM_REVISAO');
    const out = await svc.updatePilot(TENANT, 'bp-1', { status: 'APROVADO' }, CLIENTE);
    expect(out.status).toBe('APROVADO');
    expect(audit.record).toHaveBeenCalledTimes(1);
    expect((audit.record as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({
      action: 'workforce.pilot.status', tenantId: TENANT, target: 'Blueprint N1',
      actor: { id: 'user-1', email: 'renata@empresa.com' },
      meta: { pilotId: 'bp-1', from: 'EM_REVISAO', to: 'APROVADO', byName: 'Renata Dias' },
    });
  });

  it('edição sem mudar status (só esforço) NÃO gera evento; sem ator (wrapper admin) também não', async () => {
    const a = montar('EM_REVISAO');
    await a.svc.updatePilot(TENANT, 'bp-1', { effort: '6 semanas' }, CLIENTE);
    expect(a.audit.record).not.toHaveBeenCalled();

    const b = montar('EM_REVISAO');
    await b.svc.updatePilot(TENANT, 'bp-1', { status: 'SUSPENSO' });
    expect(b.audit.record).not.toHaveBeenCalled();
  });

  it('criar já com status diferente do default, com ator, audita (from null)', async () => {
    const { svc, audit } = montar();
    await svc.createPilot(TENANT, { kind: 'BLUEPRINT', name: 'Blueprint N1', baseline: 'b', indicator: 'i', confidence: 'MEDIA', status: 'EM_REVISAO' }, CLIENTE);
    expect(audit.record).toHaveBeenCalledTimes(1);
    expect((audit.record as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({ action: 'workforce.pilot.status', meta: { from: null, to: 'EM_REVISAO' } });
  });
});
