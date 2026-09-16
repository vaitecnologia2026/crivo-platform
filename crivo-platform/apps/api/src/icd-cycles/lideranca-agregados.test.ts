import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { MIN_LEADERS_FOR_DISCLOSURE } from '@crivo/types';
import { IcdCyclesService } from './icd-cycles.service';

/**
 * Tela Liderança (portal) e Módulos › Liderança (Super Admin) consomem duas
 * COMPOSIÇÕES do ICD — `history` (série por ciclo) e `summary` (KPIs do ciclo
 * aberto). O que estes testes prendem: (1) nada é recalculado — a série lê o
 * que `close()` congelou; (2) supressão §11 em todo agregado: abaixo de
 * MIN_LEADERS_FOR_DISCLOSURE, score e eixos vêm null (nunca zero, que
 * pareceria nota); (3) o delta "vs. ciclo anterior" só existe quando os dois
 * lados existem — nunca é inventado; (4) nenhum dado por líder sai daqui.
 */

const TENANT = 'org-1';
const AXES = { CLAREZA: 70, CRITERIO: 60, ALINHAMENTO: 80, SUSTENTACAO: 50 };

const cycle = (n: number, status: 'OPEN' | 'CLOSED', extra: Record<string, unknown> = {}) => ({
  id: `c${n}`,
  name: `2026-Q${n}`,
  quarter: n,
  year: 2026,
  startsAt: new Date(`2026-0${n}-01T00:00:00Z`),
  endsAt: new Date(`2026-0${n}-28T23:59:59Z`),
  status,
  closedAt: status === 'CLOSED' ? new Date(`2026-0${n}-28T23:59:59Z`) : null,
  ...extra,
});

const result = (score: number | null, eligibleLeaders: number) => ({
  id: `r-${score}`,
  score,
  suppressed: eligibleLeaders < MIN_LEADERS_FOR_DISCLOSURE,
  eligibleLeaders,
  distribution: {},
  axesAverage: eligibleLeaders < MIN_LEADERS_FOR_DISCLOSURE ? { CLAREZA: 0, CRITERIO: 0, ALINHAMENTO: 0, SUSTENTACAO: 0 } : AXES,
  computedAt: new Date('2026-06-30T00:00:00Z'),
});

/** Prisma falso: `forTenant` entrega o mesmo `tx` para toda chamada. */
function prismaCom(tx: Record<string, unknown>) {
  return { forTenant: vi.fn(async (_t: string, fn: (t: unknown) => Promise<unknown>) => fn(tx)), admin: {} };
}

/** Avaliações de decisão no ciclo aberto: `n` líderes com 1 decisão de peso 2 cada. */
const scoresDe = (n: number, score = 70) =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i}`, leaderId: `lider-${i}`, cycleId: 'c3', score, weight: 2, axes: AXES }));

describe('IcdCyclesService.history — série "Evolução do ICD"', () => {
  it('devolve os ciclos em ordem cronológica, com o resultado congelado dos fechados e null no aberto', async () => {
    const tx = {
      icdCycle: {
        findMany: vi.fn(async () => [
          cycle(1, 'CLOSED', { companyResult: result(72, 6) }),
          cycle(2, 'CLOSED', { companyResult: result(75, 7) }),
          cycle(3, 'OPEN', { companyResult: null }),
        ]),
      },
    };
    const svc = new IcdCyclesService(prismaCom(tx) as never);

    const h = await svc.history(TENANT);

    expect(h.map((e) => e.cycle.name)).toEqual(['2026-Q1', '2026-Q2', '2026-Q3']);
    expect(h[0].company?.score).toBe(72);
    expect(h[0].company?.axesAverage).toEqual(AXES);
    expect(h[0].company?.band?.key).toBe('FUNCIONAL');
    expect(h[2].company).toBeNull(); // aberto: o parcial vem de /icd-cycles/current, não daqui
    // Leitura pura do congelado: a série não toca em DecisionIcdScore.
    expect(Object.keys(tx)).toEqual(['icdCycle']);
  });

  it('ciclo fechado com menos de 5 líderes: score e eixos vêm null (supressão §11), não zero', async () => {
    const tx = {
      icdCycle: { findMany: vi.fn(async () => [cycle(1, 'CLOSED', { companyResult: result(null, 3) })]) },
    };
    const svc = new IcdCyclesService(prismaCom(tx) as never);

    const [e] = await svc.history(TENANT);

    expect(e.company?.suppressed).toBe(true);
    expect(e.company?.score).toBeNull();
    expect(e.company?.axesAverage).toBeNull();
    expect(e.company?.band).toBeNull();
    expect(e.company?.eligibleLeaders).toBe(3); // a contagem pode aparecer ("agregado suprimido: 3 líderes")
  });
});

describe('IcdCyclesService.summary — KPIs do ciclo aberto', () => {
  function build(opts: { open: boolean; scores: ReturnType<typeof scoresDe>; closed?: unknown[]; leaders?: number }) {
    const openCycle = opts.open ? cycle(3, 'OPEN') : null;
    const tx = {
      icdCycle: {
        findFirst: vi.fn(async () => openCycle),
        findMany: vi.fn(async () => opts.closed ?? []),
      },
      decisionIcdScore: { findMany: vi.fn(async () => opts.scores) },
      user: { count: vi.fn(async () => opts.leaders ?? 10) },
    };
    return { svc: new IcdCyclesService(prismaCom(tx) as never), tx };
  }

  it('sem ciclo aberto: tudo vazio e honesto — sem supressão anunciada, sem delta', async () => {
    const { svc } = build({ open: false, scores: [] });

    const s = await svc.summary(TENANT);

    expect(s.cycle).toBeNull();
    expect(s.icdMedio).toBeNull();
    expect(s.suppressed).toBe(false);
    expect(s.participatingLeaders).toBe(0);
    expect(s.decisionsEvaluated).toBe(0);
    expect(s.eligibleLeaders).toBe(10);
    expect(s.delta).toBeNull();
    expect(s.lastClosed).toBeNull();
    expect(s.minLeadersForDisclosure).toBe(MIN_LEADERS_FOR_DISCLOSURE);
  });

  it('ciclo aberto com 3 líderes avaliados: suprimido — participantes contam, ICD médio não aparece', async () => {
    const { svc } = build({ open: true, scores: scoresDe(3) });

    const s = await svc.summary(TENANT);

    expect(s.cycle?.name).toBe('2026-Q3');
    expect(s.suppressed).toBe(true);
    expect(s.icdMedio).toBeNull();
    expect(s.band).toBeNull();
    expect(s.participatingLeaders).toBe(3);
    expect(s.decisionsEvaluated).toBe(3);
  });

  it('ciclo aberto com 5 líderes: ICD médio parcial aparece e o delta compara com o último ciclo FECHADO', async () => {
    const { svc } = build({
      open: true,
      scores: scoresDe(5, 70),
      // findMany devolve desc por ano/trimestre — o primeiro é o mais recente.
      closed: [cycle(2, 'CLOSED', { companyResult: result(66, 6) }), cycle(1, 'CLOSED', { companyResult: result(60, 6) })],
    });

    const s = await svc.summary(TENANT);

    expect(s.suppressed).toBe(false);
    expect(s.icdMedio).toBe(70);
    expect(s.band?.key).toBe('FUNCIONAL');
    expect(s.lastClosed?.cycleName).toBe('2026-Q2');
    expect(s.delta).toBe(4); // 70 − 66
    expect(s.closedCycles).toBe(2);
  });

  it('último ciclo fechado suprimido: delta é null (nunca inventado) mesmo com ICD atual disponível', async () => {
    const { svc } = build({
      open: true,
      scores: scoresDe(6, 80),
      closed: [cycle(2, 'CLOSED', { companyResult: result(null, 2) })],
    });

    const s = await svc.summary(TENANT);

    expect(s.icdMedio).toBe(80);
    expect(s.lastClosed?.suppressed).toBe(true);
    expect(s.lastClosed?.score).toBeNull();
    expect(s.delta).toBeNull();
  });

  it('a resposta não carrega nada por líder (§11): só contagens e agregados', async () => {
    const { svc } = build({ open: true, scores: scoresDe(6) });

    const s = await svc.summary(TENANT);

    const texto = JSON.stringify(s);
    expect(texto).not.toContain('lider-0');
    expect(texto).not.toContain('leaderId');
  });
});
