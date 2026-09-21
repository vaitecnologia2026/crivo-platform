import { describe, expect, it, vi } from 'vitest';

// Ajustes Finais de Homologação — item 3 (recortes):
// - no Dossiê, o GHE cadastrado pela empresa é a referência dos grupos; sem GHE,
//   Área/Setor — e GHE nunca é inferido;
// - o portal oferece os demais recortes, sempre com supressão por mínimo.

vi.mock('../admin/engine-config', () => ({
  getEngineConfig: vi.fn(async () => ({ minRespondents: 5 })),
  resolveMinRespondents: vi.fn(async () => 5),
}));

vi.mock('../admin/methodology.service', () => ({
  resolveActiveMethodology: vi.fn(async () => ({
    versionId: 'v1',
    config: { rounding: 1, dimensions: [{ slug: 'dim-1', label: 'D1' }], bands: [{ label: 'Faixa única', min: 0, max: 100 }] },
  })),
  loadActiveMethodologyConfig: vi.fn(async () => ({ rounding: 1, bands: [{ label: 'Faixa única', min: 0, max: 100 }] })),
  loadMethodologyConfigByVersion: vi.fn(async () => null),
  resolveInstrumentForTenant: vi.fn(async () => 'diagnostico-essencial'),
  resolvePsychosocialInstrument: vi.fn(async () => 'diagnostico-organizacional'),
  resolveTenantInstrument: vi.fn(),
  usesPsychosocialEngine: vi.fn(async () => false),
}));

import { DocumentsService } from '../action-plans/documents.service';
import { PsychosocialService } from './psychosocial.service';

const dia = new Date('2026-09-16T12:00:00Z');
const resposta = (score: number, sector: string | null, cohort: Record<string, unknown> | null) => ({
  sector,
  score,
  byDimension: { 'dim-1': score },
  submittedAt: dia,
  origin: null,
  cohort,
});

function prismaCom(rows: ReturnType<typeof resposta>[]) {
  const tx = {
    diagnosticResponse: { findMany: vi.fn(async () => rows) },
    psychosocialResponse: { findMany: vi.fn(async () => []) },
  };
  return {
    forTenant: vi.fn(async (_t: string, fn: (t: unknown) => Promise<unknown>) => fn(tx)),
    admin: {},
  };
}

type Resumo = {
  groupBy: string;
  sectors: { sector: string; respondents: number; suppressed: boolean; score: number }[];
};

describe('Dossiê — grupo elegível: GHE cadastrado > Área/Setor', () => {
  const cincoRH = (score: number, ghe: string | null) =>
    Array.from({ length: 5 }, () => resposta(score, 'Recursos Humanos', { sector: 'Recursos Humanos', ghe }));
  const resumo = (svc: DocumentsService) =>
    (svc as unknown as { psychosocialSummary: (t: string, r: undefined, i: unknown) => Promise<Resumo> })
      .psychosocialSummary('t1', undefined, { slug: 'diagnostico-essencial', motorPsicossocial: false });

  it('sem GHE em nenhuma resposta, agrupa por setor (referência Área/Setor)', async () => {
    const svc = new DocumentsService(
      prismaCom([...cincoRH(60, null), resposta(90, 'Financeiro', { sector: 'Financeiro', ghe: null })]) as never,
      {} as never,
      {} as never,
    );
    const r = await resumo(svc);
    expect(r.groupBy).toBe('sector');
    expect(r.sectors.map((s) => [s.sector, s.respondents, s.suppressed])).toEqual([
      ['Recursos Humanos', 5, false],
      ['Financeiro', 1, true],
    ]);
  });

  it('com GHE cadastrado, o GHE vira a referência — quem não tem fica em "Não informado"', async () => {
    const svc = new DocumentsService(
      prismaCom([...cincoRH(60, 'GHE-Escritório'), resposta(90, 'Recursos Humanos', { sector: 'Recursos Humanos', ghe: null })]) as never,
      {} as never,
      {} as never,
    );
    const r = await resumo(svc);
    expect(r.groupBy).toBe('ghe');
    expect(r.sectors.map((s) => [s.sector, s.respondents, s.suppressed, s.score])).toEqual([
      ['GHE-Escritório', 5, false, 60],
      ['Não informado', 1, true, 90],
    ]);
  });
});

describe('Portal — recortes gerenciais com supressão', () => {
  it('agrupa por cada recorte do retrato e suprime n < mínimo', async () => {
    const rows = [
      ...Array.from({ length: 5 }, (_, i) =>
        resposta(50 + i, 'Operações', { sector: 'Operações', shift: 'Noite', unit: 'Matriz', generation: 'Geração Y' }),
      ),
      resposta(10, 'Operações', { sector: 'Operações', shift: 'Manhã', unit: 'Matriz', generation: 'Geração X' }),
      resposta(100, null, null), // resposta antiga, sem retrato: só conta onde tem valor
    ];
    const svc = new PsychosocialService(prismaCom(rows) as never);
    const r = await svc.recortes('t1');
    const por = Object.fromEntries(r.dimensions.map((d) => [d.key, d.groups]));
    expect(r.totalRespondents).toBe(7);
    expect(por.shift).toEqual([
      { value: 'Noite', respondents: 5, suppressed: false, score: 52, levelLabel: 'Faixa única' },
      { value: 'Manhã', respondents: 1, suppressed: true, score: null, levelLabel: null },
    ]);
    expect(por.unit[0]).toMatchObject({ value: 'Matriz', respondents: 6, suppressed: false });
    expect(por.sector[0]).toMatchObject({ value: 'Operações', respondents: 6 });
    expect(por.ghe).toBeUndefined(); // ninguém cadastrou GHE: o recorte nem aparece
  });
});
