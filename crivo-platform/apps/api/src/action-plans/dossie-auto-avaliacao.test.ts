import { beforeEach, describe, expect, it, vi } from 'vitest';

// Regressão do commit 1505f4d: o agregado do Dossiê filtrava `origin = <slug do
// instrumento>`. No motor psicossocial a coluna não existe (Prisma lançava
// "Unknown argument `origin`" — Dossiê do Organizacional caía com 500) e no
// motor de diagnóstico a resposta de campanha grava origin NULO (o Essencial
// saía suprimido, com 0 respostas válidas).

vi.mock('../admin/engine-config', () => ({
  getEngineConfig: vi.fn(async () => ({ minRespondents: 5 })),
  resolveMinRespondents: vi.fn(async () => 5),
}));

vi.mock('../admin/methodology.service', () => ({
  resolveActiveMethodology: vi.fn(async () => ({
    versionId: 'v1',
    config: {
      rounding: 2,
      dimensions: [{ slug: 'dim-1', label: 'Demandas' }],
      bands: [{ label: 'Faixa única', min: 0, max: 100 }],
    },
  })),
  resolveInstrumentForTenant: vi.fn(),
  resolveTenantInstrument: vi.fn(),
  usesPsychosocialEngine: vi.fn(),
}));

import { DocumentsService } from './documents.service';

type Linha = { sector: string | null; score: number; byDimension: Record<string, number>; submittedAt: Date; origin: string | null };

const dia = new Date('2026-09-14T12:00:00Z');
const linha = (sector: string | null, score: number, origin: string | null = null): Linha => ({
  sector,
  score,
  byDimension: { 'dim-1': score },
  submittedAt: dia,
  origin,
});

/** Simula o Prisma: aplica `where.OR` (origin nulo OU diferente) sobre a lista em memória. */
function filtra(rows: Linha[], where: Record<string, unknown>): Linha[] {
  const or = where.OR as { origin?: null | { not: string } }[] | undefined;
  if (!or) return rows;
  return rows.filter((r) =>
    or.some((c) => (c.origin === null ? r.origin === null : r.origin !== c.origin?.not)),
  );
}

describe('psychosocialSummary — auto-avaliação fora do agregado sem quebrar o Dossiê', () => {
  const campanha = [
    linha('Recursos Humanos', 60),
    linha('Recursos Humanos', 70),
    linha('Recursos Humanos', 80),
    linha('Recursos Humanos', 50),
    linha('Recursos Humanos', 40),
    linha('Financeiro', 90),
    linha('Financeiro', 30),
  ];
  const autoAvaliacao = linha(null, 100, 'SELF_ASSESSMENT');

  let psyFindMany: ReturnType<typeof vi.fn>;
  let diagFindMany: ReturnType<typeof vi.fn>;
  let svc: DocumentsService;

  beforeEach(() => {
    psyFindMany = vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      // O modelo psicossocial NÃO tem `origin`: qualquer filtro nele é o defeito.
      if ('origin' in where || 'OR' in where) throw new Error('Unknown argument `origin`');
      return campanha;
    });
    diagFindMany = vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
      filtra([...campanha, autoAvaliacao], where),
    );
    const tx = {
      psychosocialResponse: { findMany: psyFindMany },
      diagnosticResponse: { findMany: diagFindMany },
    };
    const prisma = {
      forTenant: vi.fn(async (_t: string, fn: (t: unknown) => Promise<unknown>) => fn(tx)),
      admin: {},
    };
    svc = new DocumentsService(prisma as never, {} as never, {} as never);
  });

  const resumo = (inst: { slug: string; motorPsicossocial: boolean }, opcoes?: { semAutoAvaliacao?: boolean }) =>
    (svc as unknown as {
      psychosocialSummary: (
        t: string,
        r: undefined,
        i: typeof inst,
        o?: typeof opcoes,
      ) => Promise<{ suppressed: boolean; totalRespondents: number; score?: number; sectors?: { sector: string; respondents: number; suppressed: boolean; score: number }[] }>;
    }).psychosocialSummary('tenant-1', undefined, inst, opcoes);

  it('motor psicossocial (Organizacional): nunca filtra por origin, mesmo pedindo sem auto-avaliação', async () => {
    const r = await resumo({ slug: 'diagnostico-organizacional', motorPsicossocial: true }, { semAutoAvaliacao: true });
    expect(psyFindMany).toHaveBeenCalledTimes(1);
    expect(psyFindMany.mock.calls[0][0].where).toEqual({});
    expect(r.suppressed).toBe(false);
    expect(r.totalRespondents).toBe(7);
  });

  it('motor de diagnóstico (Essencial): resposta de campanha (origin nulo) conta; só a auto-avaliação sai', async () => {
    const r = await resumo({ slug: 'diagnostico-essencial', motorPsicossocial: false }, { semAutoAvaliacao: true });
    const where = diagFindMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.instrumentSlug).toBe('diagnostico-essencial');
    expect(where.OR).toEqual([{ origin: null }, { origin: { not: 'SELF_ASSESSMENT' } }]);
    expect(r.totalRespondents).toBe(7); // 8 no banco, 1 é auto-avaliação
    expect(r.score).toBe(60); // média das 7 de campanha, sem o 100 do gestor
  });

  // Homologação 21/09: a auto-avaliação fica SEMPRE fora — antes era opcional
  // (só o Dossiê pedia) e o Relatório de Evolução somava o gestor ao agregado.
  it('sem pedir nada (Relatório de Evolução e demais) a auto-avaliação também fica fora', async () => {
    const r = await resumo({ slug: 'diagnostico-essencial', motorPsicossocial: false });
    expect(diagFindMany.mock.calls[0][0].where.OR).toBeDefined();
    expect(r.totalRespondents).toBe(7);
    expect(r.score).toBe(60);
  });

  it('devolve o score PRÓPRIO de cada setor, suprimindo os abaixo do mínimo', async () => {
    const r = await resumo({ slug: 'diagnostico-essencial', motorPsicossocial: false }, { semAutoAvaliacao: true });
    expect(r.sectors).toEqual([
      { sector: 'Recursos Humanos', respondents: 5, suppressed: false, score: 60 },
      { sector: 'Financeiro', respondents: 2, suppressed: true, score: 60 },
    ]);
  });
});
