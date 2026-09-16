import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { MIN_LEADERS_FOR_DISCLOSURE, POCKET_QUESTIONS_VERSION } from '@crivo/types';
import { PocketService } from './pocket.service';

/**
 * Gráfico "Pocket — Adesão por tema" (tela Liderança) e aba CRIVO Pocket™ do
 * Super Admin leem UM agregado: sessões concluídas por dimensão C/R/I/V/O +
 * adesão (% de líderes ativos com ≥ 1 sessão concluída). Anexo Pocket §13:
 * sessão e reflexão são do líder. O que estes testes prendem: (1) supressão
 * abaixo de MIN_LEADERS_FOR_DISCLOSURE zera tudo que poderia individualizar;
 * (2) a contagem por dimensão vem do questionCode → dimensão do catálogo
 * oficial, contando a SESSÃO uma vez por dimensão tocada (não a reflexão);
 * (3) nenhum texto de reflexão nem leaderId sai na resposta; (4) o recorte é
 * o ciclo ICD (informado ou aberto), senão todo o histórico.
 */

const TENANT = 'org-1';

const sessao = (leaderId: string, respostas: Array<[string, string | null, string[]?]>) => ({
  leaderId,
  reflections: respostas.map(([questionCode, text, tags]) => ({ questionCode, text, tags: tags ?? [] })),
});

function build(opts: { sessions: unknown[]; leaders?: number; open?: boolean }) {
  const openCycle = opts.open === false ? null : {
    id: 'c3', name: '2026-Q3', status: 'OPEN',
    startsAt: new Date('2026-07-01T00:00:00Z'), endsAt: new Date('2026-09-30T23:59:59Z'),
  };
  const tx = {
    icdCycle: { findFirst: vi.fn(async () => openCycle), findUnique: vi.fn(async () => openCycle) },
    pocketSession: { findMany: vi.fn(async (_args?: unknown) => opts.sessions) },
    user: { count: vi.fn(async () => opts.leaders ?? 10) },
  };
  const prisma = { forTenant: vi.fn(async (_t: string, fn: (t: unknown) => Promise<unknown>) => fn(tx)), admin: {} };
  return { svc: new PocketService(prisma as never, {} as never, {} as never), tx };
}

describe('PocketService.aggregate — agregado por dimensão com supressão', () => {
  it('menos de 5 líderes com sessão concluída: suprimido — sem contagens nem adesão', async () => {
    const { svc } = build({
      sessions: [sessao('l1', [['C1', 'texto']]), sessao('l2', [['R1', 'texto']]), sessao('l1', [['O1', 'texto']])],
    });

    const a = await svc.aggregate(TENANT);

    expect(a.suppressed).toBe(true);
    expect(a.participatingLeaders).toBe(2);
    expect(a.byDimension).toBeNull();
    expect(a.adhesionPct).toBeNull();
    expect(a.completedSessions).toBeNull();
    expect(a.minLeadersForDisclosure).toBe(MIN_LEADERS_FOR_DISCLOSURE);
  });

  it('5 líderes: conta a SESSÃO por dimensão tocada (uma vez por sessão) e a adesão sobre os líderes ativos', async () => {
    const { svc } = build({
      leaders: 10,
      sessions: [
        // l1 respondeu C1 e C2 (mesma dimensão → conta 1 em C) e I1.
        sessao('l1', [['C1', 'a'], ['C2', 'b'], ['I1', 'c']]),
        // l2: reflexão vazia em C1 (não conta) e só tag em V1 (conta).
        sessao('l2', [['C1', '   '], ['V1', null, ['tensão']]]),
        sessao('l3', [['R1', 'x']]),
        sessao('l4', [['O2', 'y']]),
        sessao('l5', [['C1', 'z'], ['O1', 'w']]),
        // segunda sessão do mesmo líder: conta como sessão, não como líder novo.
        sessao('l5', [['C2', 'k']]),
      ],
    });

    const a = await svc.aggregate(TENANT);

    expect(a.suppressed).toBe(false);
    expect(a.participatingLeaders).toBe(5);
    expect(a.completedSessions).toBe(6);
    expect(a.adhesionPct).toBe(50); // 5 de 10 líderes ativos
    expect(a.byDimension?.map((d) => [d.dimension, d.sessions])).toEqual([
      ['C', 3], // l1, l5 (1ª) e l5 (2ª); l2 tinha C1 vazio
      ['R', 1],
      ['I', 1],
      ['V', 1],
      ['O', 2],
    ]);
    expect(a.byDimension?.[0].label).toBe('Consciência');
    expect(a.questionsVersion).toBe(POCKET_QUESTIONS_VERSION);
  });

  it('nunca expõe texto de reflexão nem leaderId — só contagens', async () => {
    const { svc } = build({
      sessions: ['l1', 'l2', 'l3', 'l4', 'l5'].map((l) => sessao(l, [['C1', 'reflexão confidencial do líder']])),
    });

    const a = await svc.aggregate(TENANT);

    const texto = JSON.stringify(a);
    expect(texto).not.toContain('confidencial');
    expect(texto).not.toContain('leaderId');
    expect(texto).not.toContain('"l1"');
  });

  it('recorte: usa o ciclo aberto (janela completedAt) e, sem ciclo, todo o histórico', async () => {
    const comCiclo = build({ sessions: [] });
    const a = await comCiclo.svc.aggregate(TENANT);
    expect(a.period?.cycleName).toBe('2026-Q3');
    const whereComCiclo = comCiclo.tx.pocketSession.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(whereComCiclo.where.status).toBe('CONCLUIDA');
    expect(whereComCiclo.where.completedAt).toBeDefined();

    const semCiclo = build({ sessions: [], open: false });
    const b = await semCiclo.svc.aggregate(TENANT);
    expect(b.period).toBeNull();
    const whereSemCiclo = semCiclo.tx.pocketSession.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(whereSemCiclo.where.completedAt).toBeUndefined();
  });

  it('cycleId informado que não existe: 404, sem devolver agregado de outro recorte', async () => {
    const { svc, tx } = build({ sessions: [] });
    tx.icdCycle.findUnique = vi.fn(async () => null);

    await expect(svc.aggregate(TENANT, '11111111-1111-4111-8111-111111111111')).rejects.toThrow('Ciclo não encontrado');
  });
});
