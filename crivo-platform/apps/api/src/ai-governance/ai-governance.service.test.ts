import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AiGovernanceService } from './ai-governance.service';

/**
 * Governança de IA — o que estes testes prendem são as REGRAS do serviço do
 * cliente, não a persistência: (1) a decisão humana exige justificativa e
 * grava trilha própria (AiUseCaseDecision) + auditoria com o ator; (2) cada
 * decisão leva a exatamente um status; (3) a Visão Geral conta por status e
 * por risco a partir dos casos reais (e incidentes só nos últimos 12 meses);
 * (4) o código IA-NN é sequencial POR EMPRESA e nunca reaproveita número.
 */

const TENANT = 'org-1';
const ACTOR = { id: 'user-1', name: 'Renata Dias', email: 'renata@empresa.com' };

/** Prisma falso: `forTenant` entrega o mesmo `tx` para toda chamada e registra o tenant pedido. */
function prismaCom(tx: Record<string, unknown>) {
  const forTenant = vi.fn(async (_t: string, fn: (t: unknown) => Promise<unknown>) => fn(tx));
  return { forTenant, admin: {} };
}
const auditFalso = () => ({ record: vi.fn(async () => undefined) });

const caso = (extra: Record<string, unknown> = {}) => ({
  id: 'uc-1', code: 'IA-01', name: 'Triagem de currículos', purpose: 'Pré-triagem', area: 'Pessoas',
  ownerName: 'Renata Dias', ownerUserId: null, technology: 'LLM + regras', vendor: null,
  dataUsed: 'Currículos', audience: 'Candidatos', inherentRisk: 'ALTO', residualRisk: 'MEDIO',
  controls: ['Revisão humana'], status: 'EM_AVALIACAO', justification: null, nextReviewAt: null,
  createdBy: 'renata@empresa.com', createdAt: new Date('2026-09-01T00:00:00Z'), updatedAt: new Date('2026-09-01T00:00:00Z'),
  decisions: [], links: [], incidents: [], _count: { incidents: 0, links: 0 },
  ...extra,
});

describe('AiGovernanceService.decide — decisão humana', () => {
  function montar(status = 'EM_AVALIACAO') {
    const created: Record<string, unknown>[] = [];
    const updated: Record<string, unknown>[] = [];
    const tx = {
      aiUseCase: {
        findUnique: vi.fn(async () => caso({ status })),
        update: vi.fn(async (args: { data: Record<string, unknown> }) => { updated.push(args.data); return caso(); }),
      },
      aiUseCaseDecision: {
        create: vi.fn(async (args: { data: Record<string, unknown> }) => { created.push(args.data); return { id: 'dec-1', ...args.data }; }),
      },
      aiUseCaseLink: { findMany: vi.fn(async () => []) },
    };
    const audit = auditFalso();
    const svc = new AiGovernanceService(prismaCom(tx) as never, audit as never);
    return { svc, tx, audit, created, updated };
  }

  it('sem justificativa (vazia ou só espaço) não decide: 400 e NADA é gravado', async () => {
    const { svc, created, updated, audit } = montar();
    await expect(svc.decide(TENANT, 'uc-1', { decision: 'APROVAR', justification: '   ' }, ACTOR)).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.decide(TENANT, 'uc-1', { decision: 'REJEITAR', justification: '' }, ACTOR)).rejects.toBeInstanceOf(BadRequestException);
    expect(created).toHaveLength(0);
    expect(updated).toHaveLength(0);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('com justificativa grava a linha de trilha com quem decidiu, muda o status e audita com o ator', async () => {
    const { svc, created, updated, audit } = montar();
    await svc.decide(TENANT, 'uc-1', { decision: 'CONDICIONAR', justification: 'Aprovado sob revisão humana 100%.' }, ACTOR);

    // Trilha própria: uma linha por decisão, com aprovador e justificativa.
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      tenantId: TENANT,
      useCaseId: 'uc-1',
      decision: 'CONDICIONAR',
      justification: 'Aprovado sob revisão humana 100%.',
      decidedByUserId: 'user-1',
      decidedByName: 'Renata Dias',
    });
    // O caso reflete a decisão (status + justificativa vigente).
    expect(updated[0]).toMatchObject({ status: 'CONDICIONADO', justification: 'Aprovado sob revisão humana 100%.' });
    // Auditoria com ator, empresa e transição.
    expect(audit.record).toHaveBeenCalledTimes(1);
    const entry = (audit.record as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(entry).toMatchObject({
      action: 'ai_governance.decision',
      actor: { id: 'user-1', email: 'renata@empresa.com' },
      target: 'IA-01',
      tenantId: TENANT,
      meta: { decision: 'CONDICIONAR', from: 'EM_AVALIACAO', to: 'CONDICIONADO', decisionId: 'dec-1' },
    });
  });

  it('cada decisão leva a exatamente um status (Aprovar→APROVADO, Restringir→RESTRITO, Rejeitar→REJEITADO)', async () => {
    for (const [decision, status] of [['APROVAR', 'APROVADO'], ['RESTRINGIR', 'RESTRITO'], ['REJEITAR', 'REJEITADO']] as const) {
      const { svc, updated } = montar();
      await svc.decide(TENANT, 'uc-1', { decision, justification: 'motivo' }, ACTOR);
      expect(updated[0].status).toBe(status);
    }
  });

  it('um caso já decidido pode receber NOVA decisão — a anterior fica na trilha (nunca é editada)', async () => {
    const { svc, created, tx } = montar('APROVADO');
    await svc.decide(TENANT, 'uc-1', { decision: 'RESTRINGIR', justification: 'Incidente em produção.' }, ACTOR);
    expect(created).toHaveLength(1);
    expect(created[0].decision).toBe('RESTRINGIR');
    // Só INSERT na trilha: o service não tem caminho de update/delete de decisão.
    expect(Object.keys(tx.aiUseCaseDecision)).toEqual(['create']);
  });
});

describe('AiGovernanceService.addLink — vínculos (Evidências · Plano de Evolução · Workforce)', () => {
  function montar(overrides: { workTask?: Record<string, unknown> | null; existingLink?: unknown } = {}) {
    const createdLinks: Record<string, unknown>[] = [];
    const tx = {
      aiUseCase: { findUnique: vi.fn(async () => ({ id: 'uc-1' })) },
      workTask: {
        findUnique: vi.fn(async () => ('workTask' in overrides ? overrides.workTask : { code: 'T-03', name: 'Atendimento nível 1' })),
      },
      aiUseCaseLink: {
        findFirst: vi.fn(async () => overrides.existingLink ?? null),
        create: vi.fn(async (args: { data: Record<string, unknown> }) => { createdLinks.push(args.data); return { id: 'link-1', ...args.data }; }),
      },
    };
    const svc = new AiGovernanceService(prismaCom(tx) as never, auditFalso() as never);
    return { svc, tx, createdLinks };
  }

  it('vínculo WORKFORCE resolve a tarefa (código + nome) e cria o vínculo — não é mais bloqueado como "indisponível"', async () => {
    const { svc, tx, createdLinks } = montar();
    const link = await svc.addLink(TENANT, 'uc-1', { kind: 'WORKFORCE', targetId: 'task-1' });

    expect(tx.workTask.findUnique).toHaveBeenCalledWith({ where: { id: 'task-1' }, select: { code: true, name: true } });
    expect(link).toMatchObject({ kind: 'WORKFORCE', targetId: 'task-1', label: 'T-03 · Atendimento nível 1' });
    expect(createdLinks).toHaveLength(1);
    expect(createdLinks[0]).toMatchObject({ tenantId: TENANT, useCaseId: 'uc-1', kind: 'WORKFORCE', targetId: 'task-1' });
  });

  it('tarefa do Workforce inexistente (ou de outro tenant, filtrada pela RLS) devolve 404 e não cria vínculo', async () => {
    const { svc, createdLinks } = montar({ workTask: null });
    await expect(svc.addLink(TENANT, 'uc-1', { kind: 'WORKFORCE', targetId: 'task-x' })).rejects.toBeInstanceOf(NotFoundException);
    expect(createdLinks).toHaveLength(0);
  });
});

describe('AiGovernanceService.updateUseCase — edição não decide', () => {
  it('editar um caso já APROVADO preserva o status: o status só muda por decisão', async () => {
    let data: Record<string, unknown> = {};
    const tx = {
      aiUseCase: {
        findUnique: vi.fn(async () => caso({ status: 'APROVADO' })),
        update: vi.fn(async (args: { data: Record<string, unknown> }) => { data = args.data; return caso({ status: 'APROVADO' }); }),
      },
    };
    const svc = new AiGovernanceService(prismaCom(tx) as never, auditFalso() as never);
    await svc.updateUseCase(TENANT, 'uc-1', {
      name: 'Triagem', purpose: 'x', area: 'Pessoas', ownerName: 'R', technology: 'LLM', dataUsed: 'CV', audience: 'Cand.',
      inherentRisk: 'ALTO', residualRisk: 'MEDIO', status: 'RASCUNHO',
    });
    expect(data.status).toBe('APROVADO');
  });
});

describe('AiGovernanceService.summary — KPIs da Visão Geral', () => {
  it('conta casos por status e por risco (inerente e residual) a partir das linhas reais', async () => {
    const now = Date.now();
    const dia = 24 * 60 * 60 * 1000;
    const casos = [
      { status: 'APROVADO', inherentRisk: 'ALTO', residualRisk: 'MEDIO', nextReviewAt: new Date(now - 5 * dia), area: 'Pessoas' },
      { status: 'APROVADO', inherentRisk: 'BAIXO', residualRisk: 'BAIXO', nextReviewAt: new Date(now + 10 * dia), area: 'Logística' },
      { status: 'CONDICIONADO', inherentRisk: 'ALTO', residualRisk: 'MEDIO', nextReviewAt: new Date(now + 90 * dia), area: 'Jurídico' },
      { status: 'RASCUNHO', inherentRisk: 'MEDIO', residualRisk: 'MEDIO', nextReviewAt: null, area: 'Pessoas' },
      // Rejeitado com revisão vencida NÃO conta como pendência — saiu do ciclo.
      { status: 'REJEITADO', inherentRisk: 'ALTO', residualRisk: 'ALTO', nextReviewAt: new Date(now - 30 * dia), area: 'Marketing' },
    ];
    const countIncidents = vi.fn(async (args?: { where?: Record<string, unknown> }) => (args?.where?.occurredAt ? 1 : 2));
    const tx = {
      aiUseCase: { findMany: vi.fn(async () => casos) },
      aiIncident: { count: countIncidents },
      aiUseCaseDecision: { count: vi.fn(async () => 3) },
      aiPolicy: { count: vi.fn(async (args?: { where?: unknown }) => (args?.where ? 1 : 4)) },
    };
    const svc = new AiGovernanceService(prismaCom(tx) as never, auditFalso() as never);

    const s = await svc.summary(TENANT);

    expect(s.useCases).toBe(5);
    expect(s.byStatus).toEqual({ RASCUNHO: 1, EM_AVALIACAO: 0, APROVADO: 2, CONDICIONADO: 1, RESTRITO: 0, REJEITADO: 1 });
    expect(s.byInherentRisk).toEqual({ ALTO: 3, MEDIO: 1, BAIXO: 1 });
    expect(s.byResidualRisk).toEqual({ ALTO: 1, MEDIO: 3, BAIXO: 1 });
    expect(s.approved).toBe(2);
    expect(s.highInherentRisk).toBe(3);
    expect(s.reviewsOverdue).toBe(1);
    expect(s.reviewsNext30d).toBe(1);
    expect(s.decisions).toBe(3);
    expect(s.policies).toEqual({ total: 4, approved: 1 });
    expect(s.areas).toEqual(['Jurídico', 'Logística', 'Marketing', 'Pessoas']);
  });

  it('incidentes (12m) usa filtro REAL por data de ocorrência — não conta tudo que existe', async () => {
    const countIncidents = vi.fn(async (args?: { where?: Record<string, unknown> }) => (args?.where?.occurredAt ? 1 : 7));
    const tx = {
      aiUseCase: { findMany: vi.fn(async () => []) },
      aiIncident: { count: countIncidents },
      aiUseCaseDecision: { count: vi.fn(async () => 0) },
      aiPolicy: { count: vi.fn(async () => 0) },
    };
    const svc = new AiGovernanceService(prismaCom(tx) as never, auditFalso() as never);
    const s = await svc.summary(TENANT);

    expect(s.incidents12m).toBe(1);
    const chamada12m = countIncidents.mock.calls.find((c) => (c[0]?.where as Record<string, unknown> | undefined)?.occurredAt);
    const gte = (chamada12m?.[0]?.where as { occurredAt: { gte: Date } }).occurredAt.gte;
    const meses = (Date.now() - gte.getTime()) / (30.4 * 24 * 60 * 60 * 1000);
    expect(meses).toBeGreaterThan(11.5);
    expect(meses).toBeLessThan(12.5);
    // Sem caso nenhum: zeros honestos, nunca undefined.
    expect(s.useCases).toBe(0);
    expect(s.byStatus.APROVADO).toBe(0);
    expect(s.byInherentRisk.ALTO).toBe(0);
  });
});

describe('AiGovernanceService.createUseCase — código IA-NN sequencial por empresa', () => {
  function montar(codigosExistentes: string[]) {
    const created: Record<string, unknown>[] = [];
    const tx = {
      aiUseCase: {
        findMany: vi.fn(async () => codigosExistentes.map((code) => ({ code }))),
        create: vi.fn(async (args: { data: Record<string, unknown> }) => { created.push(args.data); return caso({ ...args.data, code: args.data.code as string }); }),
      },
    };
    const prisma = prismaCom(tx);
    const svc = new AiGovernanceService(prisma as never, auditFalso() as never);
    return { svc, created, prisma };
  }
  const dto = {
    name: 'Chatbot', purpose: 'Atendimento', area: 'Comercial', ownerName: 'João', technology: 'LLM API',
    dataUsed: 'Tickets', audience: 'Clientes', inherentRisk: 'MEDIO', residualRisk: 'BAIXO',
  } as const;

  it('primeira empresa sem casos recebe IA-01; a leitura acontece DENTRO da transação do tenant', async () => {
    const { svc, created, prisma } = montar([]);
    const r = await svc.createUseCase(TENANT, dto, ACTOR);
    expect(created[0].code).toBe('IA-01');
    expect(r.code).toBe('IA-01');
    expect(prisma.forTenant).toHaveBeenCalledWith(TENANT, expect.any(Function));
    expect(created[0]).toMatchObject({ tenantId: TENANT, status: 'RASCUNHO', createdBy: 'Renata Dias' });
  });

  it('segue o MAIOR número já usado + 1, mesmo com buracos — nunca reaproveita código', async () => {
    const { svc, created } = montar(['IA-01', 'IA-02', 'IA-07']);
    await svc.createUseCase(TENANT, dto, ACTOR);
    expect(created[0].code).toBe('IA-08');
  });

  it('passa de duas casas sem quebrar a sequência (IA-99 → IA-100)', async () => {
    const { svc, created } = montar(['IA-99']);
    await svc.createUseCase(TENANT, dto, ACTOR);
    expect(created[0].code).toBe('IA-100');
  });

  it('o inventário de OUTRA empresa não entra na conta: só vê o que a transação do tenant devolve', async () => {
    // A RLS (forTenant) já isola; aqui o que se prende é que o service NÃO usa
    // a conexão owner nem outro caminho fora da transação para descobrir o código.
    const { svc, created, prisma } = montar(['IA-03']);
    await svc.createUseCase('org-2', dto, ACTOR);
    expect(created[0].code).toBe('IA-04');
    expect(prisma.forTenant.mock.calls.every((c) => c[0] === 'org-2')).toBe(true);
  });
});
