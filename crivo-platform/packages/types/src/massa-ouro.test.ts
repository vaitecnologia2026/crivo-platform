import { describe, expect, it } from 'vitest';
import {
  psychosocialProbabilityFrom,
  psychosocialRiskClass,
  scoreWithMethodology,
  PSYCHOSOCIAL_RISK_CLASS_LABEL,
  type IcdAnswer,
  type MethodologyConfig,
} from './index';

// ─────────────────────────────────────────────────────────────────────────────
// MASSA OURO DE HOMOLOGAÇÃO — Diagnóstico Essencial (7 respostas), congelada em
// 09/09/2026 pelo cliente junto com o Dossiê-gabarito.
//
// A instrução de homologação é explícita: "Diferença em score, P, S, R,
// classificação ... = FAIL" e "não alterar perguntas, fatores, severidades,
// fórmulas ou faixas para fazer o sistema coincidir com o teste". Este arquivo
// é a tradução dessa regra em teste: se um número aqui mudar, o Dossiê deixou de
// bater com o gabarito do cliente.
//
// Os dados são SINTÉTICOS por definição — "Empresa Essencial Exemplo Ltda.".
// ─────────────────────────────────────────────────────────────────────────────

/** As 20 perguntas-âncora do Essencial, na ordem da planilha. */
const PERGUNTAS = [
  { id: 'DO1.1', dim: 'D1', fator: 'RPS-001', severidade: 4 },
  { id: 'DO1.3', dim: 'D1', fator: 'RPS-003', severidade: 3 },
  { id: 'DO2.1', dim: 'D2', fator: 'RPS-005', severidade: 2 },
  { id: 'DO2.3', dim: 'D2', fator: 'RPS-007', severidade: 2 },
  { id: 'DO3.1', dim: 'D3', fator: 'RPS-009', severidade: 2 },
  { id: 'DO3.3', dim: 'D3', fator: 'RPS-011', severidade: 3 },
  { id: 'DO4.2', dim: 'D4', fator: 'RPS-014', severidade: 3 },
  { id: 'DO4.3', dim: 'D4', fator: 'RPS-015', severidade: 4 },
  { id: 'DO5.1', dim: 'D5', fator: 'RPS-017', severidade: 3 },
  { id: 'DO5.2', dim: 'D5', fator: 'RPS-018', severidade: 3 },
  { id: 'DO6.2', dim: 'D6', fator: 'RPS-022', severidade: 4 },
  { id: 'DO6.4', dim: 'D6', fator: 'RPS-024', severidade: 4 },
  { id: 'DO7.1', dim: 'D7', fator: 'RPS-025', severidade: 3 },
  { id: 'DO7.3', dim: 'D7', fator: 'RPS-027', severidade: 3 },
  { id: 'DO8.1', dim: 'D8', fator: 'RPS-029', severidade: 3 },
  { id: 'DO8.4', dim: 'D8', fator: 'RPS-032', severidade: 3 },
  { id: 'DO9.1', dim: 'D9', fator: 'RPS-033', severidade: 4 },
  { id: 'DO9.2', dim: 'D9', fator: 'RPS-034', severidade: 4 },
  { id: 'DO10.1', dim: 'D10', fator: 'RPS-037', severidade: 4 },
  { id: 'DO10.4', dim: 'D10', fator: 'RPS-040', severidade: 3 },
] as const;

/** 7 respostas válidas: 5 de RH + 2 do Financeiro. Valores 1–5, na ordem acima. */
const RESPOSTAS: { area: string; valores: number[] }[] = [
  { area: 'RH', valores: [2, 2, 2, 4, 5, 4, 4, 4, 4, 2, 4, 4, 4, 5, 4, 5, 5, 4, 4, 4] },
  { area: 'RH', valores: [2, 2, 2, 4, 4, 4, 4, 4, 4, 2, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4] },
  { area: 'RH', valores: [2, 2, 2, 4, 5, 4, 4, 4, 4, 2, 4, 4, 4, 5, 4, 5, 5, 4, 4, 4] },
  { area: 'RH', valores: [3, 2, 2, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4] },
  { area: 'RH', valores: [2, 3, 3, 4, 5, 4, 4, 4, 4, 2, 4, 4, 4, 5, 4, 5, 5, 4, 4, 4] },
  { area: 'Financeiro', valores: [3, 2, 2, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4] },
  { area: 'Financeiro', valores: [3, 3, 3, 4, 5, 4, 4, 4, 4, 3, 4, 4, 4, 5, 4, 5, 5, 4, 4, 4] },
];

const DIMENSOES = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10'] as const;

/**
 * Faixas do score executivo, congeladas na planilha: 0–49 Atenção crítica ·
 * 50–64 Vulnerável · 65–79 Em estruturação · 80–100 Estruturado.
 */
const cfg: MethodologyConfig = {
  // DUAS casas: o gabarito diz 69,64, não 70. É o que exige que o agregado
  // respeite as casas da metodologia em vez de forçar inteiro.
  rounding: 2,
  aggregation: 'MEDIA_SIMPLES',
  dimensions: DIMENSOES.map((slug) => ({ slug, label: slug, weight: 1 })),
  questions: PERGUNTAS.map((q) => ({
    dimensionSlug: q.dim,
    factorSlugs: [q.fator],
    text: q.id,
    weight: 1,
    inverse: false,
  })),
  bands: [
    { code: 'CRITICA', label: 'Atenção crítica', min: 0, max: 49 },
    { code: 'VULNERAVEL', label: 'Vulnerável', min: 50, max: 64 },
    { code: 'ESTRUTURACAO', label: 'Em estruturação', min: 65, max: 79 },
    { code: 'ESTRUTURADO', label: 'Estruturado', min: 80, max: 100 },
  ],
};

const respostasDe = (valores: number[]): IcdAnswer[] =>
  valores.map((value, i) => ({ questionId: i + 1, value }));

/** Média com as MESMAS casas da metodologia — o que o agregado do motor faz. */
const media = (xs: number[], casas = 2) => {
  const f = 10 ** casas;
  return Math.round((xs.reduce((a, b) => a + b, 0) / xs.length + Number.EPSILON) * f) / f;
};

describe('Massa Ouro · Essencial (7 respostas) — score executivo', () => {
  const porRespondente = RESPOSTAS.map((r) => scoreWithMethodology(respostasDe(r.valores), cfg));

  it('reproduz o score agregado de cada dimensão', () => {
    const agregado = DIMENSOES.map((slug) =>
      media(porRespondente.map((r) => r.byDimension.find((d) => d.slug === slug)!.value)),
    );
    expect(agregado).toEqual([
      33.93, // Demandas e Ritmo de Trabalho — Atenção crítica
      53.57, // Autonomia e Participação — Vulnerável
      82.14, // Clareza de Papel e Conteúdo do Trabalho — Estruturado
      75, //    Recursos e Condições de Execução — Em estruturação
      55.36, // Liderança e Suporte — Vulnerável
      75, //    Relações, Respeito e Segurança Psicológica — Em estruturação
      82.14, // Reconhecimento e Justiça Organizacional — Estruturado
      82.14, // Mudanças e Previsibilidade — Estruturado
      82.14, // Estabilidade e Segurança do Vínculo — Estruturado
      75, //    Jornada, Recuperação e Equilíbrio Trabalho-Vida — Em estruturação
    ]);
  });

  it('reproduz o score geral 69,64 (e NÃO 70)', () => {
    expect(media(porRespondente.map((r) => r.score))).toBe(69.64);
  });

  it('classifica o ciclo em "Em estruturação"', () => {
    // A faixa vem da régua da metodologia, não de constante no código.
    const geral = media(porRespondente.map((r) => r.score));
    const faixa = cfg.bands!.find((b) => geral >= b.min && geral <= b.max);
    expect(faixa?.label).toBe('Em estruturação');
  });
});

describe('Massa Ouro · Essencial — risco técnico por fator (P × S)', () => {
  /** Pool de exposições do fator: exposição = 6 − resposta, todas as respostas. */
  const exposicoesDe = (fator: string) => {
    const i = PERGUNTAS.findIndex((q) => q.fator === fator);
    return RESPOSTAS.map((r) => 6 - r.valores[i]);
  };

  const casos = [
    // fator, exposição média, % em exposição alta, P, S, R
    { fator: 'RPS-001', exposicao: 3.57, altaPct: '57.1', p: 4, s: 4, r: 16 },
    { fator: 'RPS-003', exposicao: 3.71, altaPct: '71.4', p: 5, s: 3, r: 15 },
    { fator: 'RPS-005', exposicao: 3.71, altaPct: '71.4', p: 5, s: 2, r: 10 },
    { fator: 'RPS-018', exposicao: 3.57, altaPct: '57.1', p: 4, s: 3, r: 12 },
  ] as const;

  for (const c of casos) {
    it(`${c.fator}: exposição ${c.exposicao} → P${c.p} × S${c.s} = R${c.r}`, () => {
      const exposicoes = exposicoesDe(c.fator);
      const { probability, exposureAvg, highExposureCount } = psychosocialProbabilityFrom(exposicoes);
      expect(Number(exposureAvg.toFixed(2))).toBe(c.exposicao);
      // A frase impressa no Inventário Técnico do Dossiê.
      expect(((highExposureCount / exposicoes.length) * 100).toFixed(1)).toBe(c.altaPct);
      expect(probability).toBe(c.p);
      const severidade = PERGUNTAS.find((q) => q.fator === c.fator)!.severidade;
      expect(severidade).toBe(c.s);
      expect(probability * severidade).toBe(c.r);
    });
  }

  it('RPS-003 e RPS-005 sobem para P5 pela regra dos 60%, não pela média', () => {
    // Média 3,71 cairia em P4 pela faixa; são os 71,4% em exposição alta que
    // levam a probabilidade ao topo. Sem essa regra o R de RPS-003 sairia 12.
    const exposicoes = exposicoesDe('RPS-003');
    const { probability, exposureAvg } = psychosocialProbabilityFrom(exposicoes);
    expect(exposureAvg).toBeLessThan(4.5);
    expect(probability).toBe(5);
  });

  it('classifica os quatro fatores prioritários como o Dossiê-gabarito', () => {
    const classes = casos.map((c) => PSYCHOSOCIAL_RISK_CLASS_LABEL[psychosocialRiskClass(c.r)]);
    expect(classes).toEqual([
      'Muito alto / Prioridade imediata', // R 16
      'Alto / Requer plano de ação', //     R 15
      'Alto / Requer plano de ação', //     R 10
      'Alto / Requer plano de ação', //     R 12
    ]);
  });

  it('exige plano de ação exatamente a partir de R 10', () => {
    expect(psychosocialRiskClass(9)).toBe('MODERADO');
    expect(psychosocialRiskClass(10)).toBe('ALTO');
  });
});
