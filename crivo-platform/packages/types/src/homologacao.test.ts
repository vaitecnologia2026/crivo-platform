import { describe, expect, it } from 'vitest';
import {
  classifyTechnicalRisk,
  scoreWithMethodology,
  type MethodologyConfig,
  type IcdAnswer,
} from './index';

// ─────────────────────────────────────────────────────────────────────────────
// HOMOLOGAÇÃO OFICIAL — pacote "Configuração dos Seis Motores" v3.1 (15/07/2026)
// Anexos D e E trazem `sample_expected_result` com RESULTADO CONHECIDO que o
// desenvolvedor DEVE reproduzir. Estes testes são o gate do caso C01.
// Os dados abaixo são de HOMOLOGAÇÃO (fictícios) — não são metodologia oficial.
// ─────────────────────────────────────────────────────────────────────────────

/** Monta um instrumento cujas dimensões atingem valores-alvo conhecidos.
 *  Escala 1–5 → 0/25/50/75/100, então cada alvo múltiplo de 25 é 1 pergunta;
 *  alvos intermediários (ex.: 74, 66) usam 2 perguntas com pesos calibrados. */
function dimWithValue(slug: string, label: string, weight: number) {
  return { slug, label, weight };
}

describe('Homologação Anexo D — Diagnóstico Organizacional (62,4 · Vulnerável)', () => {
  // Dimensões e pesos literais do Anexo D: D1 .30 / D2 .25 / D3 .25 / D4 .20
  // sample_expected_result.dimension_scores = {D1:74, D2:66, D3:58, D4:46}
  // overall_index = 74*.30 + 66*.25 + 58*.25 + 46*.20 = 62.4 → "Vulnerável"
  const cfg: MethodologyConfig = {
    rounding: 1,
    aggregation: 'MEDIA_PONDERADA',
    dimensions: [
      dimWithValue('D1', 'Demandas e carga', 0.3),
      dimWithValue('D2', 'Organização e clareza', 0.25),
      dimWithValue('D3', 'Suporte e liderança', 0.25),
      dimWithValue('D4', 'Mudanças e comunicação', 0.2),
    ],
    // Uma pergunta por dimensão, com peso 1: o valor da dimensão é o da resposta.
    // Para cravar 74/66/58/46 usamos duas perguntas com pesos que compõem o alvo.
    questions: [
      // D1 = 74  → (75*0.96 + 50*0.04) = 74
      { dimensionSlug: 'D1', text: 'D1a', weight: 0.96, inverse: false },
      { dimensionSlug: 'D1', text: 'D1b', weight: 0.04, inverse: false },
      // D2 = 66  → (75*0.64 + 50*0.36) = 66
      { dimensionSlug: 'D2', text: 'D2a', weight: 0.64, inverse: false },
      { dimensionSlug: 'D2', text: 'D2b', weight: 0.36, inverse: false },
      // D3 = 58  → (75*0.32 + 50*0.68) = 58
      { dimensionSlug: 'D3', text: 'D3a', weight: 0.32, inverse: false },
      { dimensionSlug: 'D3', text: 'D3b', weight: 0.68, inverse: false },
      // D4 = 46  → (50*0.84 + 25*0.16) = 46
      { dimensionSlug: 'D4', text: 'D4a', weight: 0.84, inverse: false },
      { dimensionSlug: 'D4', text: 'D4b', weight: 0.16, inverse: false },
    ],
    // illustrative_bands do Anexo D (limites com 1 decimal)
    bands: [
      { code: 'FAVORAVEL', label: 'Favorável', min: 0, max: 24.9 },
      { code: 'ATENCAO', label: 'Atenção', min: 25, max: 49.9 },
      { code: 'VULNERAVEL', label: 'Vulnerável', min: 50, max: 74.9 },
      { code: 'CRITICO', label: 'Crítico', min: 75, max: 100 },
    ],
  };

  const answers: IcdAnswer[] = [
    { questionId: 1, value: 4 }, { questionId: 2, value: 3 }, // D1 → 74
    { questionId: 3, value: 4 }, { questionId: 4, value: 3 }, // D2 → 66
    { questionId: 5, value: 4 }, { questionId: 6, value: 3 }, // D3 → 58
    { questionId: 7, value: 3 }, { questionId: 8, value: 2 }, // D4 → 46
  ];

  it('reproduz as dimensões do sample_expected_result', () => {
    const r = scoreWithMethodology(answers, cfg);
    expect(r.byDimension.map((d) => [d.slug, d.value])).toEqual([
      ['D1', 74], ['D2', 66], ['D3', 58], ['D4', 46],
    ]);
  });

  it('reproduz overall_index = 62.4 com 1 casa decimal', () => {
    expect(scoreWithMethodology(answers, cfg).score).toBe(62.4);
  });

  it('classifica na faixa "Vulnerável"', () => {
    expect(scoreWithMethodology(answers, cfg).levelLabel).toBe('Vulnerável');
  });
});

describe('Homologação Anexo E — Prontidão para IA (47,3 · Experimental)', () => {
  // Pesos literais: E .20 / G .20 / D .15 / P .20 / C .15 / O .10
  // dimension_scores = {E:62, G:38, D:55, P:44, C:48, O:30}
  // overall = 12.4+7.6+8.25+8.8+7.2+3.0 = 47.25 → arredonda para 47.3
  const cfg: MethodologyConfig = {
    rounding: 1,
    aggregation: 'MEDIA_PONDERADA',
    dimensions: [
      dimWithValue('E', 'Estratégia e valor', 0.2),
      dimWithValue('G', 'Governança e risco', 0.2),
      dimWithValue('D', 'Dados e tecnologia', 0.15),
      dimWithValue('P', 'Pessoas, skills e liderança', 0.2),
      dimWithValue('C', 'Cultura e adoção', 0.15),
      dimWithValue('O', 'Operação e mensuração', 0.1),
    ],
    questions: [
      { dimensionSlug: 'E', text: 'E1', weight: 0.48, inverse: false }, // 75*.48+50*.52 = 62
      { dimensionSlug: 'E', text: 'E2', weight: 0.52, inverse: false },
      { dimensionSlug: 'G', text: 'G1', weight: 0.52, inverse: false }, // 50*.52+25*.48 = 38
      { dimensionSlug: 'G', text: 'G2', weight: 0.48, inverse: false },
      { dimensionSlug: 'D', text: 'D1', weight: 0.2, inverse: false },  // 75*.2+50*.8 = 55
      { dimensionSlug: 'D', text: 'D2', weight: 0.8, inverse: false },
      { dimensionSlug: 'P', text: 'P1', weight: 0.76, inverse: false }, // 50*.76+25*.24 = 44
      { dimensionSlug: 'P', text: 'P2', weight: 0.24, inverse: false },
      { dimensionSlug: 'C', text: 'C1', weight: 0.92, inverse: false }, // 50*.92+25*.08 = 48
      { dimensionSlug: 'C', text: 'C2', weight: 0.08, inverse: false },
      { dimensionSlug: 'O', text: 'O1', weight: 0.2, inverse: false },  // 50*.2+25*.8 = 30
      { dimensionSlug: 'O', text: 'O2', weight: 0.8, inverse: false },
    ],
    bands: [
      { code: 'INICIAL', label: 'Inicial', min: 0, max: 24.9 },
      { code: 'EXPERIMENTAL', label: 'Experimental', min: 25, max: 49.9 },
      { code: 'ESTRUTURADA', label: 'Estruturada', min: 50, max: 74.9 },
      { code: 'GOVERNADA', label: 'Governada e escalável', min: 75, max: 100 },
    ],
  };

  const answers: IcdAnswer[] = [
    { questionId: 1, value: 4 }, { questionId: 2, value: 3 },  // E → 62
    { questionId: 3, value: 3 }, { questionId: 4, value: 2 },  // G → 38
    { questionId: 5, value: 4 }, { questionId: 6, value: 3 },  // D → 55
    { questionId: 7, value: 3 }, { questionId: 8, value: 2 },  // P → 44
    { questionId: 9, value: 3 }, { questionId: 10, value: 2 }, // C → 48
    { questionId: 11, value: 3 }, { questionId: 12, value: 2 },// O → 30
  ];

  it('reproduz as dimensões do sample_expected_result', () => {
    const r = scoreWithMethodology(answers, cfg);
    expect(r.byDimension.map((d) => d.value)).toEqual([62, 38, 55, 44, 48, 30]);
  });

  it('reproduz overall_readiness = 47.3 (47,25 arredondado a 1 casa)', () => {
    expect(scoreWithMethodology(answers, cfg).score).toBe(47.3);
  });

  it('classifica na faixa "Experimental"', () => {
    expect(scoreWithMethodology(answers, cfg).levelLabel).toBe('Experimental');
  });
});

describe('Itens de contexto, condicionais e gate de cobertura', () => {
  const base: MethodologyConfig = {
    rounding: 1,
    minimumValidCompletionPercent: 70,
    dimensions: [dimWithValue('D1', 'Dim 1', 1)],
    questions: [
      { dimensionSlug: 'D1', text: 'Q1', weight: 1, inverse: false },
      { dimensionSlug: 'D1', text: 'Q2', weight: 1, inverse: false },
      // Item de CONTEXTO (Anexo D `scored:false`) — nunca entra no cálculo.
      { dimensionSlug: 'D1', text: 'Contexto livre', weight: 1, inverse: false, scored: false },
      // CONDICIONAL: só aplicável se Q2 >= 4 (Anexo D `show_when` do item D1F1).
      { dimensionSlug: 'D1', text: 'Q4 condicional', weight: 1, inverse: false, showWhen: { questionId: 2, operator: '>=', value: 4 } },
    ],
    bands: [{ code: 'X', label: 'Faixa', min: 0, max: 100 }],
  };

  it('item de contexto (scored:false) não altera o score nem a cobertura', () => {
    // Q1=5 (100), Q2=5 (100) → condicional aplicável e respondida
    const r = scoreWithMethodology(
      [{ questionId: 1, value: 5 }, { questionId: 2, value: 5 }, { questionId: 4, value: 5 }],
      base,
    );
    expect(r.score).toBe(100);
    expect(r.coverage).toBe(100); // 3 pontuáveis aplicáveis, 3 respondidas
  });

  it('condicional NÃO disparado sai do cálculo e do denominador', () => {
    // Q2=1 (<4) → o item 4 é não-aplicável; cobertura considera só Q1 e Q2
    const r = scoreWithMethodology(
      [{ questionId: 1, value: 5 }, { questionId: 2, value: 1 }],
      base,
    );
    expect(r.coverage).toBe(100);
    expect(r.officialResultBlocked).toBe(false);
    expect(r.score).toBe(50); // (100 + 0) / 2
  });

  it('bloqueia o resultado oficial abaixo da cobertura mínima', () => {
    // Só Q1 respondida de 3 aplicáveis → 33,3% < 70%
    const r = scoreWithMethodology([{ questionId: 1, value: 5 }, { questionId: 2, value: 5 }], {
      ...base,
      questions: [
        ...base.questions.slice(0, 2),
        { dimensionSlug: 'D1', text: 'Q3', weight: 1, inverse: false },
        { dimensionSlug: 'D1', text: 'Q4', weight: 1, inverse: false },
        { dimensionSlug: 'D1', text: 'Q5', weight: 1, inverse: false },
      ],
    });
    expect(r.coverage).toBe(40); // 2 de 5
    expect(r.officialResultBlocked).toBe(true);
  });
});

describe('Matriz Severidade × Probabilidade do dossiê (doc 09 §6)', () => {
  it('reproduz a matriz 3×3 literal', () => {
    expect(classifyTechnicalRisk('Baixa', 'Baixa')).toBe('Baixo');
    expect(classifyTechnicalRisk('Baixa', 'Moderada')).toBe('Baixo');
    expect(classifyTechnicalRisk('Baixa', 'Alta')).toBe('Moderado');
    expect(classifyTechnicalRisk('Moderada', 'Baixa')).toBe('Baixo');
    expect(classifyTechnicalRisk('Moderada', 'Moderada')).toBe('Moderado');
    expect(classifyTechnicalRisk('Moderada', 'Alta')).toBe('Alto');
    expect(classifyTechnicalRisk('Alta', 'Baixa')).toBe('Moderado');
    expect(classifyTechnicalRisk('Alta', 'Moderada')).toBe('Alto');
    expect(classifyTechnicalRisk('Alta', 'Alta')).toBe('Alto');
  });

  it('reproduz os technical_risks do sample do Anexo D', () => {
    // {Alta,Alta}→Alto · {Alta,Moderada}→Alto · {Moderada,Alta}→Alto · {Moderada,Moderada}→Moderado
    expect(classifyTechnicalRisk('Alta', 'Alta')).toBe('Alto');
    expect(classifyTechnicalRisk('Alta', 'Moderada')).toBe('Alto');
    expect(classifyTechnicalRisk('Moderada', 'Alta')).toBe('Alto');
    expect(classifyTechnicalRisk('Moderada', 'Moderada')).toBe('Moderado');
  });
});
