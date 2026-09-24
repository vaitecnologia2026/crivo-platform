import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MethodologyConfig } from '@crivo/types';

/**
 * Dossiê Organizacional — modelo oficial de 23/09:
 *  (1) cada GHE elegível é calculado de forma INDEPENDENTE, só com as respostas
 *      do próprio grupo (a matriz por grupo agrupava pela coluna `sector`);
 *  (2) fator sem pergunta vinculada (contextual, ex.: RPS-C01) não herda a
 *      exposição da dimensão inteira — na Massa Ouro ele nascia "Alto" (P2 × S5)
 *      sem nenhuma resposta sobre ele.
 */
const m = vi.hoisted(() => ({
  resolveMinRespondents: vi.fn(),
  resolveInstrumentForTenant: vi.fn(),
  resolvePsychosocialInstrument: vi.fn(),
  usesPsychosocialEngine: vi.fn(),
  loadActiveMethodologyConfig: vi.fn(),
  loadMethodologyConfigByVersion: vi.fn(),
}));
vi.mock('../admin/engine-config', () => ({
  resolveMinRespondents: m.resolveMinRespondents,
  getEngineConfig: vi.fn(),
}));
vi.mock('../admin/methodology.service', () => ({
  resolveInstrumentForTenant: m.resolveInstrumentForTenant,
  resolvePsychosocialInstrument: m.resolvePsychosocialInstrument,
  usesPsychosocialEngine: m.usesPsychosocialEngine,
  loadActiveMethodologyConfig: m.loadActiveMethodologyConfig,
  loadMethodologyConfigByVersion: m.loadMethodologyConfigByVersion,
  resolveActiveMethodology: vi.fn(),
}));

import { PsychosocialService } from './psychosocial.service';

// Pergunta 1 → Sobrecarga (S4); pergunta 2 → Apoio social (S3). O fator
// contextual RPS-C01 (S5) está cadastrado na dimensão de Relações, SEM pergunta.
const CFG: MethodologyConfig = {
  rounding: 1,
  dimensions: [
    { slug: 'd1', label: 'Demandas e Ritmo de Trabalho', weight: 1 },
    { slug: 'd6', label: 'Relações, Respeito e Segurança Psicológica', weight: 1 },
  ],
  questions: [
    { dimensionSlug: 'd1', factorSlugs: ['rps-001'], text: 'q1', weight: 1, inverse: false },
    { dimensionSlug: 'd6', factorSlugs: ['rps-021'], text: 'q2', weight: 1, inverse: false },
  ],
  bands: [
    { code: 'CRIT', label: 'Atenção crítica', min: 0, max: 49 },
    { code: 'VULN', label: 'Vulnerável', min: 50, max: 64 },
    { code: 'ESTR', label: 'Em estruturação', min: 65, max: 79 },
    { code: 'OK', label: 'Estruturado', min: 80, max: 100 },
  ],
};
const VERSAO_ATIVA = {
  dimensions: [
    { slug: 'd1', severity: null, parentSlug: null },
    { slug: 'd6', severity: null, parentSlug: null },
  ],
  factors: [
    { slug: 'rps-001', label: 'Sobrecarga de trabalho', severity: 4, consequences: null, dimensionSlug: 'd1', code: 'RPS-001', definition: null, sourceContext: null, status: 'ATIVO' },
    { slug: 'rps-021', label: 'Falta de apoio social no trabalho', severity: 3, consequences: null, dimensionSlug: 'd6', code: 'RPS-021', definition: null, sourceContext: null, status: 'ATIVO' },
    { slug: 'rps-c01', label: 'Violência grave / agressão física / evento traumático relacionado ao trabalho', severity: 5, consequences: null, dimensionSlug: 'd6', code: 'RPS-C01', definition: null, sourceContext: null, status: 'ATIVO' },
  ],
  questions: [
    { dimensionSlug: 'd1', factorSlugs: ['rps-001'] },
    { dimensionSlug: 'd6', factorSlugs: ['rps-021'] },
  ],
};

/** Resposta anônima com o GHE no retrato, como grava a campanha. */
const resposta = (ghe: string, q1: number, q2: number) => ({
  sector: 'Área qualquer',
  cohort: { ghe },
  score: 70,
  byDimension: { d1: 70, d6: 70 },
  byFactor: null,
  answers: [
    { questionId: 1, value: q1 },
    { questionId: 2, value: q2 },
  ],
  methodologyVersionId: 'v-1',
});

// Operações responde "2" na sobrecarga (exposição 4 = alta); Financeiro "4"
// (exposição 2). Um GHE com 2 respostas fica abaixo do mínimo (5).
const RESPOSTAS = [
  ...Array.from({ length: 5 }, () => resposta('GHE-Operações', 2, 4)),
  ...Array.from({ length: 5 }, () => resposta('GHE-Financeiro', 4, 4)),
  ...Array.from({ length: 2 }, () => resposta('GHE-Pequeno', 3, 4)),
];

function servico(versao = VERSAO_ATIVA) {
  const tx = { psychosocialResponse: { findMany: vi.fn(async () => RESPOSTAS) } };
  const prisma = {
    admin: { methodologyVersion: { findFirst: vi.fn(async () => versao) } },
    forTenant: vi.fn(async (_t: string, fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return new PsychosocialService(prisma as never);
}

beforeEach(() => {
  m.resolveMinRespondents.mockResolvedValue(5);
  m.resolveInstrumentForTenant.mockResolvedValue('diagnostico-organizacional');
  m.usesPsychosocialEngine.mockResolvedValue(true);
  m.loadActiveMethodologyConfig.mockResolvedValue(CFG);
  m.loadMethodologyConfigByVersion.mockResolvedValue(CFG);
});

type Linha = { slug: string; probability: number; risk: number; exposureAvg: number };
const linha = (matriz: Linha[] | undefined, slug: string) => matriz?.find((r) => r.slug === slug);

describe('matriz de risco por GHE (Dossiê Organizacional)', () => {
  it('fator contextual sem pergunta vinculada fica FORA da matriz (RPS-C01)', async () => {
    const r = await servico().results('org-1');
    const geral = r.overall.suppressed ? [] : r.overall.riskMatrix;
    expect(geral.map((x) => x.slug)).not.toContain('rps-c01');
    for (const g of r.ghes) {
      if ('riskMatrix' in g) expect(g.riskMatrix?.map((x) => x.slug)).not.toContain('rps-c01');
    }
  });

  it('versão SEM nenhum vínculo pergunta→fator mantém o fallback por dimensão (legado)', async () => {
    const semVinculo = {
      ...VERSAO_ATIVA,
      questions: VERSAO_ATIVA.questions.map((q) => ({ ...q, factorSlugs: [] as string[] })),
    };
    const r = await servico(semVinculo).results('org-1');
    const geral = r.overall.suppressed ? [] : r.overall.riskMatrix;
    expect(geral.map((x) => x.slug)).toContain('rps-c01');
  });

  it('cada GHE elegível tem a PRÓPRIA matriz, só com as respostas do grupo', async () => {
    const r = await servico().results('org-1');
    const ops = r.ghes.find((g) => g.ghe === 'GHE-Operações');
    const fin = r.ghes.find((g) => g.ghe === 'GHE-Financeiro');
    const opsM = ops && 'riskMatrix' in ops ? ops.riskMatrix : undefined;
    const finM = fin && 'riskMatrix' in fin ? fin.riskMatrix : undefined;

    // Operações: exposição 4 em 100% das respostas → regra dos 60% → P = 5.
    expect(linha(opsM, 'rps-001')).toMatchObject({ exposureAvg: 4, probability: 5, risk: 20 });
    // Financeiro: exposição 2 → P = 2 → R = 8 (não exige plano).
    expect(linha(finM, 'rps-001')).toMatchObject({ exposureAvg: 2, probability: 2, risk: 8 });
    // O geral mistura os três grupos (12 respostas): (5×4 + 5×2 + 2×3) / 12 = 3,0.
    const geral = r.overall.suppressed ? undefined : r.overall.riskMatrix;
    expect(linha(geral, 'rps-001')).toMatchObject({ exposureAvg: 3, probability: 3, risk: 12 });
  });

  it('GHE abaixo do mínimo sai suprimido, sem números', async () => {
    const r = await servico().results('org-1');
    const peq = r.ghes.find((g) => g.ghe === 'GHE-Pequeno');
    expect(peq).toMatchObject({ respondents: 2, suppressed: true });
    expect(peq && 'riskMatrix' in peq).toBe(false);
  });

  it('ordem do modelo: mais respondentes primeiro, empate pelo nome', async () => {
    const r = await servico().results('org-1');
    expect(r.ghes.map((g) => g.ghe)).toEqual(['GHE-Financeiro', 'GHE-Operações', 'GHE-Pequeno']);
  });
});

describe('agregado por GHE é de uso interno (revisão 24/09)', () => {
  it('a rota /psychosocial/results não publica `ghes`', async () => {
    const { PsychosocialController } = await import('./psychosocial.controller');
    const ctrl = new PsychosocialController(servico());
    const r = (await ctrl.results({ tenantId: 'org-1' } as never)) as Record<string, unknown>;
    expect(r).not.toHaveProperty('ghes');
    expect(r).toHaveProperty('sectors');
  });

  it('fora do motor psicossocial (Essencial), não calcula GHE', async () => {
    m.usesPsychosocialEngine.mockResolvedValue(false);
    const svc = servico();
    const tx = { diagnosticResponse: { findMany: vi.fn(async () => RESPOSTAS) } };
    (svc as unknown as { prisma: { forTenant: unknown } }).prisma.forTenant = vi.fn(
      async (_t: string, fn: (t: typeof tx) => unknown) => fn(tx),
    );
    const r = await svc.results('org-1');
    expect(r.ghes).toEqual([]);
  });
});
