import { describe, it, expect } from 'vitest';
import {
  exposureOf,
  exposuresFromAnswers,
  psychosocialProbabilityLevel,
  psychosocialProbabilityFrom,
  psychosocialRiskClass,
  PSYCHOSOCIAL_RISK_PLAN_REQUIRED,
  PSYCHOSOCIAL_RISK_CLASS_ACTION,
  type MethodologyConfig,
} from './index';

/** Matriz 5×5 (NR-1 1.5.4.4.2) — spec do cliente, seções 6 e 8. */
describe('Exposição (§6.1)', () => {
  it('pergunta POSITIVA: exposicao = 6 - resposta', () => {
    expect(exposureOf(1)).toBe(5); // discordo totalmente = pior
    expect(exposureOf(2)).toBe(4);
    expect(exposureOf(3)).toBe(3);
    expect(exposureOf(4)).toBe(2);
    expect(exposureOf(5)).toBe(1); // concordo totalmente = melhor
  });

  it('pergunta NEGATIVA (inverse): a exposição é o próprio valor', () => {
    // "Sinto-me sobrecarregado" — concordar é o pior caso.
    expect(exposureOf(5, true)).toBe(5);
    expect(exposureOf(1, true)).toBe(1);
  });
});

describe('Probabilidade por faixa de exposição média (§6.2)', () => {
  it('respeita as bordas de cada faixa', () => {
    expect(psychosocialProbabilityLevel(1.0)).toBe(1);
    expect(psychosocialProbabilityLevel(1.49)).toBe(1);
    expect(psychosocialProbabilityLevel(1.5)).toBe(2);
    expect(psychosocialProbabilityLevel(2.49)).toBe(2);
    expect(psychosocialProbabilityLevel(2.5)).toBe(3);
    expect(psychosocialProbabilityLevel(3.49)).toBe(3);
    expect(psychosocialProbabilityLevel(3.5)).toBe(4);
    expect(psychosocialProbabilityLevel(4.49)).toBe(4);
    expect(psychosocialProbabilityLevel(4.5)).toBe(5);
    expect(psychosocialProbabilityLevel(5.0)).toBe(5);
  });

  it('regra dos 60%: exposição alta na maioria força probabilidade 5', () => {
    // 7 de 10 em exposição alta (4), resto mínimo: média 3,1 → faixa 3…
    const exposures = [4, 4, 4, 4, 4, 4, 4, 1, 1, 1];
    const semRegra = psychosocialProbabilityLevel(
      exposures.reduce((a, b) => a + b, 0) / exposures.length,
    );
    expect(semRegra).toBe(3);
    // …mas 70% > 60% em exposição alta ⇒ 5.
    expect(psychosocialProbabilityFrom(exposures).probability).toBe(5);
  });

  it('exatamente 60% NÃO dispara a regra (é "mais de 60%")', () => {
    const exposures = [4, 4, 4, 4, 4, 4, 1, 1, 1, 1]; // 60%
    expect(psychosocialProbabilityFrom(exposures).probability).toBe(
      psychosocialProbabilityLevel(2.8),
    );
  });

  it('devolve a média e a contagem de exposições altas', () => {
    const r = psychosocialProbabilityFrom([5, 4, 2, 1]);
    expect(r.exposureAvg).toBe(3);
    expect(r.highExposureCount).toBe(2); // 5 e 4
  });
});

describe('Faixas de criticidade (§8.4)', () => {
  it('respeita as bordas de cada faixa', () => {
    expect(psychosocialRiskClass(1)).toBe('BAIXO');
    expect(psychosocialRiskClass(4)).toBe('BAIXO');
    expect(psychosocialRiskClass(5)).toBe('MODERADO');
    expect(psychosocialRiskClass(9)).toBe('MODERADO');
    expect(psychosocialRiskClass(10)).toBe('ALTO');
    expect(psychosocialRiskClass(15)).toBe('ALTO');
    expect(psychosocialRiskClass(16)).toBe('MUITO_ALTO');
    expect(psychosocialRiskClass(20)).toBe('MUITO_ALTO');
    expect(psychosocialRiskClass(21)).toBe('CRITICO');
    expect(psychosocialRiskClass(25)).toBe('CRITICO');
  });

  it('plano de ação é obrigatório a partir de risco 10', () => {
    expect(PSYCHOSOCIAL_RISK_PLAN_REQUIRED[psychosocialRiskClass(9)]).toBe(false);
    expect(PSYCHOSOCIAL_RISK_PLAN_REQUIRED[psychosocialRiskClass(10)]).toBe(true);
    expect(PSYCHOSOCIAL_RISK_PLAN_REQUIRED[psychosocialRiskClass(25)]).toBe(true);
  });

  it('ação recomendada por faixa', () => {
    expect(PSYCHOSOCIAL_RISK_CLASS_ACTION[psychosocialRiskClass(2)]).toBe('Monitorar');
    expect(PSYCHOSOCIAL_RISK_CLASS_ACTION[psychosocialRiskClass(6)]).toBe('Prevenir');
    expect(PSYCHOSOCIAL_RISK_CLASS_ACTION[psychosocialRiskClass(12)]).toBe('Corrigir');
    expect(PSYCHOSOCIAL_RISK_CLASS_ACTION[psychosocialRiskClass(18)]).toBe('Mitigar urgentemente');
    expect(PSYCHOSOCIAL_RISK_CLASS_ACTION[psychosocialRiskClass(24)]).toBe('Ação imediata');
  });

  it('produtos da tabela 8.3 caem na faixa correta', () => {
    expect(psychosocialRiskClass(5 * 1)).toBe('MODERADO'); // severidade 5, prob 1
    expect(psychosocialRiskClass(1 * 5)).toBe('MODERADO'); // simétrico
    expect(psychosocialRiskClass(4 * 4)).toBe('MUITO_ALTO');
    expect(psychosocialRiskClass(3 * 3)).toBe('MODERADO');
    expect(psychosocialRiskClass(5 * 5)).toBe('CRITICO');
  });
});

describe('Exemplo completo da spec (§6.4)', () => {
  const cfg: MethodologyConfig = {
    dimensions: [{ slug: 'demandas', label: 'Demandas', weight: 1 }],
    questions: [
      { dimensionSlug: 'demandas', text: 'O volume de trabalho é compatível com o tempo disponível.', weight: 1, inverse: false, factorSlugs: ['sobrecarga'] },
    ],
    bands: [{ code: 'C', label: 'Crítico', min: 0, max: 49 }, { code: 'OK', label: 'OK', min: 50, max: 100 }],
    factors: [{ slug: 'sobrecarga', label: 'Sobrecarga de trabalho', severity: 4, dimensionSlug: 'demandas' }],
  };

  it('média 2,0 → exposição 4,0 → probabilidade 4 → risco 16 (muito alto, plano obrigatório)', () => {
    // Duas respostas com média 2,0 (1 e 3).
    const r1 = exposuresFromAnswers([{ questionId: 1, value: 1 }], cfg);
    const r2 = exposuresFromAnswers([{ questionId: 1, value: 3 }], cfg);
    const pool = [...r1.byFactor.sobrecarga, ...r2.byFactor.sobrecarga];
    const { probability, exposureAvg } = psychosocialProbabilityFrom(pool);
    expect(exposureAvg).toBe(4); // (5 + 3) / 2
    expect(probability).toBe(4);
    const risco = probability * 4; // severidade 4
    expect(risco).toBe(16);
    expect(psychosocialRiskClass(risco)).toBe('MUITO_ALTO');
    expect(PSYCHOSOCIAL_RISK_PLAN_REQUIRED[psychosocialRiskClass(risco)]).toBe(true);
  });

  it('item de contexto (scored:false) e condicional não disparado ficam fora', () => {
    const c2: MethodologyConfig = {
      ...cfg,
      questions: [
        { dimensionSlug: 'demandas', text: 'contexto', weight: 1, inverse: false, scored: false, factorSlugs: ['sobrecarga'] },
        { dimensionSlug: 'demandas', text: 'condicional', weight: 1, inverse: false, factorSlugs: ['sobrecarga'], showWhen: { questionId: 1, operator: '>=', value: 4 } },
      ],
    };
    const r = exposuresFromAnswers([{ questionId: 1, value: 1 }, { questionId: 2, value: 1 }], c2);
    expect(r.byFactor.sobrecarga).toBeUndefined(); // nenhuma das duas entra
  });
});
