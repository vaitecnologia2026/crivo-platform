import { describe, it, expect } from 'vitest';
import { scoreWithMethodology, type MethodologyConfig } from './index';

/**
 * NR-1 §9 — "a pergunta alimenta um ou mais fatores". O vínculo com fatores é a
 * leitura de RISCO e NÃO pode interferir na pontuação (dimensão → score 0–100).
 */
const cfg: MethodologyConfig = {
  dimensions: [
    { slug: 'demandas', label: 'Demandas', weight: 1 },
    { slug: 'apoio', label: 'Apoio', weight: 1 },
  ],
  questions: [
    // 1 e 2 na dimensão demandas; a 1 alimenta DOIS fatores.
    { dimensionSlug: 'demandas', text: 'q1', weight: 1, inverse: false, factorSlugs: ['sobrecarga', 'prazo'] },
    { dimensionSlug: 'demandas', text: 'q2', weight: 1, inverse: false, factorSlugs: ['sobrecarga'] },
    // 3 na dimensão apoio, sem fator: entra no score, fica fora da matriz.
    { dimensionSlug: 'apoio', text: 'q3', weight: 1, inverse: false },
  ],
  bands: [
    { code: 'CRITICO', label: 'Crítico', min: 0, max: 49 },
    { code: 'OK', label: 'Adequado', min: 50, max: 100 },
  ],
  factors: [
    { slug: 'sobrecarga', label: 'Sobrecarga', severity: 4, dimensionSlug: 'demandas' },
    { slug: 'prazo', label: 'Pressão de prazo', severity: 3, dimensionSlug: 'demandas' },
    { slug: 'orfao', label: 'Fator sem pergunta', severity: 5, dimensionSlug: null },
  ],
};

describe('byFactor (cadeia pergunta → fator, NR-1 §9)', () => {
  // q1=1 → 0; q2=5 → 100; q3=3 → 50
  const answers = [
    { questionId: 1, value: 1 },
    { questionId: 2, value: 5 },
    { questionId: 3, value: 3 },
  ];

  it('calcula a média das perguntas vinculadas a cada fator', () => {
    const r = scoreWithMethodology(answers, cfg);
    const by = Object.fromEntries(r.byFactor.map((f) => [f.slug, f.value]));
    expect(by.sobrecarga).toBe(50); // média de q1(0) e q2(100)
    expect(by.prazo).toBe(0); // só q1
  });

  it('omite fator sem nenhuma pergunta vinculada (não vira 0)', () => {
    const r = scoreWithMethodology(answers, cfg);
    expect(r.byFactor.find((f) => f.slug === 'orfao')).toBeUndefined();
  });

  it('NÃO interfere no score nem em byDimension', () => {
    const semFatores: MethodologyConfig = {
      ...cfg,
      factors: undefined,
      questions: cfg.questions.map((q) => ({ ...q, factorSlugs: undefined })),
    };
    const comFator = scoreWithMethodology(answers, cfg);
    const sem = scoreWithMethodology(answers, semFatores);
    expect(comFator.score).toBe(sem.score);
    expect(comFator.byDimension).toEqual(sem.byDimension);
    expect(sem.byFactor).toEqual([]); // sem fatores no config, lista vazia
  });

  it('uma pergunta pode alimentar vários fatores ao mesmo tempo', () => {
    const r = scoreWithMethodology(answers, cfg);
    const slugs = r.byFactor.map((f) => f.slug).sort();
    expect(slugs).toEqual(['prazo', 'sobrecarga']);
  });
});
