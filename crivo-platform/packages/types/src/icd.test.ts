import { describe, it, expect } from "vitest";
import {
  // 4 Eixos (Anexo §6-§9)
  computeDecisionIcd,
  icdAxisValueToScore,
  // Diagnóstico Inicial (Briefing §5 — pré-diagnóstico da LP)
  computePreDiagnostic,
  PRE_DIAGNOSTIC_QUESTIONS,
  PRE_DIAGNOSTIC_DIMENSIONS,
  PRE_DIAGNOSTIC_DIMENSION_LABEL,
  scoreWithMethodology,
  type MethodologyConfig,
  // Ciclo trimestral (Anexo §9.4-§9.6, §10, §11)
  computeLeaderQuarterlyIcd,
  computeCompanyQuarterlyIcd,
  getIcdMaturityBand,
  applyIcdSuppression,
  MIN_LEADERS_FOR_DISCLOSURE,
  // Pocket (Anexo Pocket §6)
  POCKET_QUESTIONS,
  // Catálogos
  ICD_QUESTIONS,
  // Psicossocial (Briefing §6)
  computePsychosocial,
  psychosocialLevel,
  PSYCHOSOCIAL_QUESTIONS,
  PSYCHOSOCIAL_DIMENSIONS,
  PSYCHOSOCIAL_DIMENSION_LABEL,
  computeInvisibleCosts,
  computePeopleTrends,
  aggregateBenchmarks,
  porteBandOf,
  computeOperationalAlerts,
} from "./index";

// ============================================================
// Diagnóstico Inicial (pré-diagnóstico público)
// ============================================================

describe("computePreDiagnostic (Briefing §5)", () => {
  it("100% maturidade quando todas as respostas são 5", () => {
    const answers = PRE_DIAGNOSTIC_QUESTIONS.map((q) => ({ questionId: q.id, value: 5 }));
    const r = computePreDiagnostic(answers);
    expect(r.score).toBe(100);
    expect(r.level).toBe("AVANCADO");
  });

  it("0% maturidade quando todas as respostas são 1", () => {
    const answers = PRE_DIAGNOSTIC_QUESTIONS.map((q) => ({ questionId: q.id, value: 1 }));
    const r = computePreDiagnostic(answers);
    expect(r.score).toBe(0);
    expect(r.level).toBe("INICIAL");
  });

  it("classifica nível por score: <40 INICIAL, <60 EM_ESTRUTURACAO, <80 ESTRUTURADO, >=80 AVANCADO", () => {
    // Misture respostas para cair em cada faixa
    const halfFive = PRE_DIAGNOSTIC_QUESTIONS.map((q) => ({ questionId: q.id, value: 3 }));
    const r = computePreDiagnostic(halfFive);
    // 3 → (3-1)/4 * 100 = 50 → score = 50 → EM_ESTRUTURACAO
    expect(r.score).toBe(50);
    expect(r.level).toBe("EM_ESTRUTURACAO");
  });

  it("#4 — empate: todas as dimensões com a menor maturidade entram em topAttentions", () => {
    // q1-q4 baixos → pressao_rotina e lideranca_sustentacao empatam na menor nota (25); demais 100.
    const low = new Set([1, 2, 3, 4]);
    const answers = PRE_DIAGNOSTIC_QUESTIONS.map((q) => ({ questionId: q.id, value: low.has(q.id) ? 2 : 5 }));
    const r = computePreDiagnostic(answers);
    expect(r.byDimension.pressao_rotina).toBe(25);
    expect(r.byDimension.lideranca_sustentacao).toBe(25);
    expect(r.topAttentions).toEqual(["pressao_rotina", "lideranca_sustentacao"]);
    expect(r.topAttentions).toContain(r.topAttention);
  });
});

// ============================================================
// 4 Eixos — Anexo §6-§9
// ============================================================

describe("icdAxisValueToScore (Anexo §8)", () => {
  it("converte escala 1-5 → 0-100 (fórmula (v-1)*25)", () => {
    expect(icdAxisValueToScore(1)).toBe(0);
    expect(icdAxisValueToScore(2)).toBe(25);
    expect(icdAxisValueToScore(3)).toBe(50);
    expect(icdAxisValueToScore(4)).toBe(75);
    expect(icdAxisValueToScore(5)).toBe(100);
  });

  it("recusa valores fora de 1-5", () => {
    expect(() => icdAxisValueToScore(0)).toThrow();
    expect(() => icdAxisValueToScore(6)).toThrow();
    expect(() => icdAxisValueToScore(3.5)).toThrow();
  });
});

describe("computeDecisionIcd (Anexo §9.1-§9.2)", () => {
  it("calcula ICD = média dos 4 eixos com média das 2 perguntas cada", () => {
    // P1=4, P2=4 → CLAREZA = (75+75)/2 = 75
    // P3=3, P4=4 → CRITERIO = (50+75)/2 = 62.5 → 63 (round)
    // P5=3, P6=3 → ALINHAMENTO = (50+50)/2 = 50
    // P7=4, P8=4 → SUSTENTACAO = (75+75)/2 = 75
    // ICD = (75 + 63 + 50 + 75) / 4 = 263/4 = 65.75 → 66
    const answers = [
      { id: "P1", value: 4 }, { id: "P2", value: 4 },
      { id: "P3", value: 3 }, { id: "P4", value: 4 },
      { id: "P5", value: 3 }, { id: "P6", value: 3 },
      { id: "P7", value: 4 }, { id: "P8", value: 4 },
    ];
    const r = computeDecisionIcd(answers, "MEDIO");
    expect(r.score).toBe(66);
    expect(r.axes.CLAREZA).toBe(75);
    expect(r.axes.CRITERIO).toBe(63);
    expect(r.axes.ALINHAMENTO).toBe(50);
    expect(r.axes.SUSTENTACAO).toBe(75);
    expect(r.weight).toBe(1); // MEDIO → peso 1 (§9.3)
  });

  it("peso 0 para impacto BAIXO (§9.3)", () => {
    const answers = [
      { id: "P1", value: 5 }, { id: "P2", value: 5 },
      { id: "P3", value: 5 }, { id: "P4", value: 5 },
      { id: "P5", value: 5 }, { id: "P6", value: 5 },
      { id: "P7", value: 5 }, { id: "P8", value: 5 },
    ];
    const r = computeDecisionIcd(answers, "BAIXO");
    expect(r.score).toBe(100);
    expect(r.weight).toBe(0); // BAIXO fica fora do ICD oficial
  });

  it("peso 2 para impacto ALTO (§9.3)", () => {
    const answers = POCKET_QUESTIONS.slice(0, 0).concat(
      [{ id: "P1", value: 3 }, { id: "P2", value: 3 }, { id: "P3", value: 3 }, { id: "P4", value: 3 },
       { id: "P5", value: 3 }, { id: "P6", value: 3 }, { id: "P7", value: 3 }, { id: "P8", value: 3 }] as any,
    );
    const r = computeDecisionIcd(answers as any, "ALTO");
    expect(r.weight).toBe(2);
  });

  it("recusa quando faltam respostas (não tem as 8)", () => {
    expect(() => computeDecisionIcd([{ id: "P1", value: 4 }], "MEDIO")).toThrow();
  });

  it("recusa quando alguma das P1-P8 está ausente", () => {
    const answers = [
      { id: "P1", value: 4 }, { id: "P2", value: 4 },
      { id: "P3", value: 4 }, { id: "P4", value: 4 },
      { id: "P5", value: 4 }, { id: "P6", value: 4 },
      { id: "P7", value: 4 }, { id: "P9", value: 4 }, // P9 não existe; faltou P8
    ];
    expect(() => computeDecisionIcd(answers, "MEDIO")).toThrow();
  });
});

// ============================================================
// Faixas de Maturidade — Anexo §10
// ============================================================

describe("getIcdMaturityBand (Anexo §10)", () => {
  it("0-49 → Crítica", () => {
    expect(getIcdMaturityBand(0).key).toBe("CRITICA");
    expect(getIcdMaturityBand(49).key).toBe("CRITICA");
  });
  it("50-64 → Desenvolvimento", () => {
    expect(getIcdMaturityBand(50).key).toBe("DESENVOLVIMENTO");
    expect(getIcdMaturityBand(64).key).toBe("DESENVOLVIMENTO");
  });
  it("65-74 → Funcional", () => {
    expect(getIcdMaturityBand(65).key).toBe("FUNCIONAL");
    expect(getIcdMaturityBand(74).key).toBe("FUNCIONAL");
  });
  it("75-84 → Consistente", () => {
    expect(getIcdMaturityBand(75).key).toBe("CONSISTENTE");
    expect(getIcdMaturityBand(84).key).toBe("CONSISTENTE");
  });
  it("85-94 → Avançada", () => {
    expect(getIcdMaturityBand(85).key).toBe("AVANCADA");
    expect(getIcdMaturityBand(94).key).toBe("AVANCADA");
  });
  it("95-100 → Elevada (validar consistência)", () => {
    expect(getIcdMaturityBand(95).key).toBe("ELEVADA");
    expect(getIcdMaturityBand(100).key).toBe("ELEVADA");
  });
  it("clampa valores fora de 0-100", () => {
    expect(getIcdMaturityBand(-10).key).toBe("CRITICA");
    expect(getIcdMaturityBand(110).key).toBe("ELEVADA");
  });
});

// ============================================================
// Supressão — Anexo §11
// ============================================================

describe("applyIcdSuppression (Anexo §11)", () => {
  it(`suprime quando < ${MIN_LEADERS_FOR_DISCLOSURE} líderes`, () => {
    const r = applyIcdSuppression([70, 80, 60]);
    expect(r.suppressed).toBe(true);
    expect(r.score).toBeNull();
    expect(r.count).toBe(3);
  });

  it(`calcula média quando >= ${MIN_LEADERS_FOR_DISCLOSURE}`, () => {
    const r = applyIcdSuppression([70, 80, 60, 90, 50]);
    expect(r.suppressed).toBe(false);
    expect(r.score).toBe(70); // (70+80+60+90+50)/5 = 70
    expect(r.count).toBe(5);
  });

  it("array vazio → suprimido", () => {
    const r = applyIcdSuppression([]);
    expect(r.suppressed).toBe(true);
    expect(r.score).toBeNull();
  });
});

// ============================================================
// ICD trimestral líder — Anexo §9.4
// ============================================================

describe("computeLeaderQuarterlyIcd (Anexo §9.4)", () => {
  it("ignora decisões com peso 0 (BAIXO)", () => {
    const scores = [
      { score: 90, weight: 0, axes: { CLAREZA: 90, CRITERIO: 90, ALINHAMENTO: 90, SUSTENTACAO: 90 } as any },
      { score: 60, weight: 1, axes: { CLAREZA: 60, CRITERIO: 60, ALINHAMENTO: 60, SUSTENTACAO: 60 } as any },
    ];
    const r = computeLeaderQuarterlyIcd(scores);
    expect(r?.score).toBe(60); // só conta a com peso 1
    expect(r?.decisionCount).toBe(1);
    expect(r?.totalWeight).toBe(1);
  });

  it("média ponderada com peso 1 (MEDIO) e 2 (ALTO) — exemplo do Anexo §9.4", () => {
    // Do anexo: ((72*2)+(80*1)+(76*1))/4 = 300/4 = 75
    const scores = [
      { score: 72, weight: 2, axes: { CLAREZA: 72, CRITERIO: 72, ALINHAMENTO: 72, SUSTENTACAO: 72 } as any },
      { score: 80, weight: 1, axes: { CLAREZA: 80, CRITERIO: 80, ALINHAMENTO: 80, SUSTENTACAO: 80 } as any },
      { score: 76, weight: 1, axes: { CLAREZA: 76, CRITERIO: 76, ALINHAMENTO: 76, SUSTENTACAO: 76 } as any },
    ];
    const r = computeLeaderQuarterlyIcd(scores);
    expect(r?.score).toBe(75);
    expect(r?.decisionCount).toBe(3);
    expect(r?.totalWeight).toBe(4);
    expect(r?.axesAverage.CLAREZA).toBe(75);
  });

  it("retorna null se 0 decisões elegíveis", () => {
    const r = computeLeaderQuarterlyIcd([{ score: 50, weight: 0 }]);
    expect(r).toBeNull();
  });
});

// ============================================================
// ICD empresa — Anexo §9.5
// ============================================================

describe("computeCompanyQuarterlyIcd (Anexo §9.5)", () => {
  const baseAxes = { CLAREZA: 70, CRITERIO: 70, ALINHAMENTO: 70, SUSTENTACAO: 70 } as any;

  it(`suprime quando < ${MIN_LEADERS_FOR_DISCLOSURE} líderes elegíveis`, () => {
    const r = computeCompanyQuarterlyIcd([
      { score: 70, axesAverage: baseAxes },
      { score: 80, axesAverage: baseAxes },
    ]);
    expect(r.suppressed).toBe(true);
    expect(r.score).toBeNull();
    expect(r.eligibleLeaders).toBe(2);
  });

  it("calcula média dos ICDs dos líderes (NÃO média direta de decisões)", () => {
    const r = computeCompanyQuarterlyIcd([
      { score: 70, axesAverage: baseAxes },
      { score: 80, axesAverage: baseAxes },
      { score: 60, axesAverage: baseAxes },
      { score: 90, axesAverage: baseAxes },
      { score: 50, axesAverage: baseAxes },
    ]);
    expect(r.suppressed).toBe(false);
    expect(r.score).toBe(70);
    expect(r.eligibleLeaders).toBe(5);
  });

  it("popula distribuição por faixa de maturidade (§10)", () => {
    const r = computeCompanyQuarterlyIcd([
      { score: 30, axesAverage: baseAxes }, // CRITICA
      { score: 55, axesAverage: baseAxes }, // DESENVOLVIMENTO
      { score: 70, axesAverage: baseAxes }, // FUNCIONAL
      { score: 80, axesAverage: baseAxes }, // CONSISTENTE
      { score: 90, axesAverage: baseAxes }, // AVANCADA
      { score: 98, axesAverage: baseAxes }, // ELEVADA
    ]);
    expect(r.distribution.CRITICA).toBe(1);
    expect(r.distribution.DESENVOLVIMENTO).toBe(1);
    expect(r.distribution.FUNCIONAL).toBe(1);
    expect(r.distribution.CONSISTENTE).toBe(1);
    expect(r.distribution.AVANCADA).toBe(1);
    expect(r.distribution.ELEVADA).toBe(1);
  });
});

// ============================================================
// Catálogos — sanity checks dos dados estáticos
// ============================================================

describe("Catálogos oficiais", () => {
  it("ICD tem exatamente 8 perguntas (4 Rs × 2)", () => {
    expect(ICD_QUESTIONS.length).toBe(8);
  });

  it("Pocket tem exatamente 10 perguntas (5 dimensões × 2)", () => {
    expect(POCKET_QUESTIONS.length).toBe(10);
    expect(POCKET_QUESTIONS.map((q) => q.code)).toEqual([
      "C1", "C2", "R1", "R2", "I1", "I2", "V1", "V2", "O1", "O2",
    ]);
  });

  it("nenhuma pergunta do Pocket termina com ? (são afirmações reflexivas, mas perguntas no Pocket TÊM ?)", () => {
    // Pocket §6 — as 10 são perguntas reflexivas, USAM ?
    expect(POCKET_QUESTIONS.every((q) => q.text.endsWith("?"))).toBe(true);
  });
});

// ============================================================
// Questionário Psicossocial Organizacional (Briefing §6)
// ============================================================

describe("computePsychosocial (Briefing §6)", () => {
  const all = (v: number) =>
    PSYCHOSOCIAL_QUESTIONS.map((q) => ({ questionId: q.id, value: v }));

  it("tem 12 perguntas, 2 por dimensão (6 dimensões)", () => {
    expect(PSYCHOSOCIAL_QUESTIONS).toHaveLength(12);
    for (const d of PSYCHOSOCIAL_DIMENSIONS) {
      expect(PSYCHOSOCIAL_QUESTIONS.filter((q) => q.dimension === d)).toHaveLength(2);
    }
  });

  it("tudo no máximo (5) → proteção 100 e risco BAIXO", () => {
    const r = computePsychosocial(all(5));
    expect(r.score).toBe(100);
    expect(r.level).toBe("BAIXO");
    for (const d of PSYCHOSOCIAL_DIMENSIONS) expect(r.byDimension[d]).toBe(100);
  });

  it("tudo no mínimo (1) → proteção 0 e risco CRITICO", () => {
    const r = computePsychosocial(all(1));
    expect(r.score).toBe(0);
    expect(r.level).toBe("CRITICO");
  });

  it("identifica a dimensão de maior risco (menor proteção)", () => {
    const answers = all(5).map((a) =>
      // rebaixa as duas perguntas de 'relacoes' (ids 11,12) ao mínimo
      a.questionId === 11 || a.questionId === 12 ? { ...a, value: 1 } : a,
    );
    const r = computePsychosocial(answers);
    expect(r.topRisk).toBe("relacoes");
    expect(r.byDimension.relacoes).toBe(0);
  });

  it("rejeita resposta ausente ou fora da escala", () => {
    expect(() => computePsychosocial(all(5).slice(0, 11))).toThrow();
    expect(() => computePsychosocial(all(7))).toThrow();
  });

  it("bandas de nível por score", () => {
    expect(psychosocialLevel(75)).toBe("BAIXO");
    expect(psychosocialLevel(60)).toBe("MODERADO");
    expect(psychosocialLevel(40)).toBe("ALTO");
    expect(psychosocialLevel(10)).toBe("CRITICO");
  });
});

// ============================================================
// Metodologia configurável (Fase 1C) — equivalência com o hardcode
// ============================================================
describe("scoreWithMethodology vs computePreDiagnostic (v1 = padrão CRIVO)", () => {
  const V1: MethodologyConfig = {
    dimensions: PRE_DIAGNOSTIC_DIMENSIONS.map((slug) => ({
      slug,
      label: PRE_DIAGNOSTIC_DIMENSION_LABEL[slug],
      weight: 1,
    })),
    questions: PRE_DIAGNOSTIC_QUESTIONS.map((q) => ({
      dimensionSlug: q.dimension,
      text: q.text,
      weight: 1,
      inverse: false,
    })),
    bands: [
      { code: "INICIAL", label: "Inicial", min: 0, max: 39 },
      { code: "EM_ESTRUTURACAO", label: "Em estruturação", min: 40, max: 59 },
      { code: "ESTRUTURADO", label: "Estruturado", min: 60, max: 79 },
      { code: "AVANCADO", label: "Avançado", min: 80, max: 100 },
    ],
  };

  const cases: number[][] = [
    PRE_DIAGNOSTIC_QUESTIONS.map(() => 5),
    PRE_DIAGNOSTIC_QUESTIONS.map(() => 1),
    PRE_DIAGNOSTIC_QUESTIONS.map(() => 3),
    PRE_DIAGNOSTIC_QUESTIONS.map((_, i) => (i % 5) + 1),
    [5, 4, 3, 2, 1, 2, 3, 4, 5, 1],
  ];

  cases.forEach((values, idx) => {
    it(`caso ${idx}: score, faixa, dimensões e pontos de atenção batem`, () => {
      const answers = PRE_DIAGNOSTIC_QUESTIONS.map((q, i) => ({ questionId: q.id, value: values[i] }));
      const hard = computePreDiagnostic(answers);
      const cfg = scoreWithMethodology(answers, V1);
      expect(cfg.score).toBe(hard.score);
      expect(cfg.levelCode).toBe(hard.level);
      const hardByDim = hard.byDimension as Record<string, number>;
      for (const d of cfg.byDimension) {
        expect(d.value).toBe(hardByDim[d.slug]);
      }
      expect([...cfg.topAttentions].sort()).toEqual([...(hard.topAttentions ?? [hard.topAttention])].sort());
    });
  });

  it("inverse: inverte a pontuação da pergunta", () => {
    const cfg: MethodologyConfig = {
      dimensions: [{ slug: "d", label: "D", weight: 1 }],
      questions: [{ dimensionSlug: "d", text: "q", weight: 1, inverse: true }],
      bands: [
        { code: "BAIXO", label: "Baixo", min: 0, max: 49 },
        { code: "ALTO", label: "Alto", min: 50, max: 100 },
      ],
    };
    expect(scoreWithMethodology([{ questionId: 1, value: 5 }], cfg).score).toBe(0);
    expect(scoreWithMethodology([{ questionId: 1, value: 1 }], cfg).score).toBe(100);
  });
});

describe("scoreWithMethodology vs computePsychosocial (v1 = padrão Organizacional)", () => {
  const V1: MethodologyConfig = {
    dimensions: PSYCHOSOCIAL_DIMENSIONS.map((slug) => ({
      slug,
      label: PSYCHOSOCIAL_DIMENSION_LABEL[slug],
      weight: 1,
    })),
    questions: PSYCHOSOCIAL_QUESTIONS.map((q) => ({
      dimensionSlug: q.dimension,
      text: q.text,
      weight: 1,
      inverse: false,
    })),
    bands: [
      { code: "CRITICO", label: "Risco crítico", min: 0, max: 34 },
      { code: "ALTO", label: "Risco alto", min: 35, max: 54 },
      { code: "MODERADO", label: "Risco moderado", min: 55, max: 74 },
      { code: "BAIXO", label: "Risco baixo", min: 75, max: 100 },
    ],
  };

  const cases: number[][] = [
    PSYCHOSOCIAL_QUESTIONS.map(() => 5),
    PSYCHOSOCIAL_QUESTIONS.map(() => 1),
    PSYCHOSOCIAL_QUESTIONS.map((_, i) => (i % 5) + 1),
    [5, 4, 3, 2, 1, 2, 3, 4, 5, 1, 2, 4],
  ];

  cases.forEach((values, idx) => {
    it(`caso ${idx}: score, nível (risco) e dimensões batem`, () => {
      const answers = PSYCHOSOCIAL_QUESTIONS.map((q, i) => ({ questionId: q.id, value: values[i] }));
      const hard = computePsychosocial(answers);
      const cfg = scoreWithMethodology(answers, V1);
      expect(cfg.score).toBe(hard.score);
      expect(cfg.levelCode).toBe(hard.level);
      const hardByDim = hard.byDimension as Record<string, number>;
      for (const d of cfg.byDimension) expect(d.value).toBe(hardByDim[d.slug]);
      expect(cfg.topAttentions[0]).toBe(hard.topRisk);
    });
  });
});

// ============================================================
// Custos Invisíveis (Fase 2)
// ============================================================
describe("computeInvisibleCosts", () => {
  it("base = variação × volume × custo unitário, cenários e soma", () => {
    const r = computeInvisibleCosts(
      [
        { key: "a", label: "A", variation: 10, volume: 2, unitCost: 100 }, // base 2000
        { key: "b", label: "B", variation: 5, volume: 1, unitCost: 1000 }, // base 5000
      ],
      { conservador: 1.3, moderado: 1, otimista: 0.7 },
    );
    expect(r.items[0].base).toBe(2000);
    expect(r.items[0].conservador).toBe(2600);
    expect(r.items[0].otimista).toBe(1400);
    expect(r.total.base).toBe(7000);
    expect(r.total.conservador).toBeCloseTo(9100);
    expect(r.total.moderado).toBe(7000);
    expect(r.total.otimista).toBeCloseTo(4900);
  });

  it("usa cenários padrão e trata valores ausentes como 0", () => {
    const r = computeInvisibleCosts([{ key: "x", label: "X", variation: 3, volume: 4, unitCost: 5 }]);
    expect(r.total.base).toBe(60);
    expect(r.total.moderado).toBe(60);
  });

  it("lista vazia → zeros", () => {
    const r = computeInvisibleCosts([]);
    expect(r.total.base).toBe(0);
    expect(r.items).toHaveLength(0);
  });
});

// ============================================================
// People Analytics (Fase 4)
// ============================================================
describe("computePeopleTrends", () => {
  it("latest/previous/delta/direção/good por indicador", () => {
    const r = computePeopleTrends([
      { period: "2026-Q1", values: { turnover: 20, produtividade: 70 } },
      { period: "2026-Q2", values: { turnover: 15, produtividade: 80 } },
    ]);
    expect(r.periodsCount).toBe(2);
    expect(r.latestPeriod).toBe("2026-Q2");
    const turn = r.trends.find((t) => t.key === "turnover")!;
    expect(turn.latest).toBe(15);
    expect(turn.previous).toBe(20);
    expect(turn.delta).toBe(-5);
    expect(turn.direction).toBe("down");
    expect(turn.good).toBe(true); // turnover caindo = bom
    const prod = r.trends.find((t) => t.key === "produtividade")!;
    expect(prod.direction).toBe("up");
    expect(prod.good).toBe(true); // produtividade subindo = bom
  });

  it("ordena por período e marca 'na' quando falta dado", () => {
    const r = computePeopleTrends([
      { period: "2026-Q2", values: {} },
      { period: "2026-Q1", values: { turnover: 10 } },
    ]);
    expect(r.latestPeriod).toBe("2026-Q2");
    expect(r.trends.find((t) => t.key === "turnover")!.direction).toBe("na");
  });

  it("lista vazia → tudo 'na'", () => {
    const r = computePeopleTrends([]);
    expect(r.periodsCount).toBe(0);
    expect(r.trends.every((t) => t.direction === "na")).toBe(true);
  });
});

// ============================================================
// Base CRIVO / Benchmarks (Fase 5)
// ============================================================
describe("aggregateBenchmarks + porteBandOf", () => {
  it("porteBandOf classifica por headcount", () => {
    expect(porteBandOf(5)).toBe("Micro (1–9)");
    expect(porteBandOf(30)).toBe("Pequeno (10–49)");
    expect(porteBandOf(120)).toBe("Médio (50–249)");
    expect(porteBandOf(500)).toBe("Grande (250+)");
    expect(porteBandOf(0)).toBeNull();
    expect(porteBandOf(null)).toBeNull();
  });

  it("agrupa, calcula média e SUPRIME recorte com menos de minCount", () => {
    const r = aggregateBenchmarks(
      [
        { group: "A", indicators: { turnover: 10 } },
        { group: "A", indicators: { turnover: 20 } },
        { group: "A", indicators: { turnover: 30 } },
        { group: "B", indicators: { turnover: 5 } }, // só 1 → suprimido
      ],
      3,
    );
    expect(r.totalRecords).toBe(4);
    const a = r.groups.find((g) => g.group === "A")!;
    expect(a.count).toBe(3);
    expect(a.suppressed).toBe(false);
    expect(a.averages.turnover).toBe(20);
    const b = r.groups.find((g) => g.group === "B")!;
    expect(b.suppressed).toBe(true);
    expect(Object.keys(b.averages)).toHaveLength(0);
    expect(r.suppressedGroups).toBe(1);
  });
});

// ============================================================
// Notificações & Travas operacionais (Fase 3 — §12)
// ============================================================
describe("computeOperationalAlerts", () => {
  const now = 1_700_000_000_000;

  it("ação atrasada (high) + baixa adesão (warn) + evidência pendente", () => {
    const r = computeOperationalAlerts(
      {
        campaigns: [{ name: "C1", active: true, adesao: 12 }],
        actionItems: [{ title: "A1", status: "EM_ANDAMENTO", dueDateMs: now - 1000, hasExpectedEvidence: true, hasResponsible: true }],
        unvalidatedPlans: [],
      },
      now,
    );
    expect(r.alerts.some((a) => a.kind === "baixa-adesao")).toBe(true);
    expect(r.alerts.some((a) => a.kind === "acao-atrasada" && a.severity === "high")).toBe(true);
    expect(r.alerts.some((a) => a.kind === "evidencia-pendente")).toBe(true);
  });

  it("travas: sem prazo, sem evidência esperada, plano não validado", () => {
    const r = computeOperationalAlerts(
      {
        campaigns: [],
        actionItems: [{ title: "A2", status: "APROVADA", dueDateMs: null, hasExpectedEvidence: false, hasResponsible: false }],
        unvalidatedPlans: [{ title: "P1", itemCount: 3 }],
      },
      now,
    );
    expect(r.locks.some((l) => l.kind === "sem-prazo")).toBe(true);
    expect(r.locks.some((l) => l.kind === "sem-responsavel")).toBe(true);
    expect(r.locks.some((l) => l.kind === "sem-evidencia-esperada")).toBe(true);
    expect(r.locks.some((l) => l.kind === "plano-nao-validado")).toBe(true);
  });

  it("ação concluída não gera alerta nem trava", () => {
    const r = computeOperationalAlerts(
      {
        campaigns: [],
        actionItems: [{ title: "ok", status: "CONCLUIDA", dueDateMs: now - 9999, hasExpectedEvidence: false, hasResponsible: false }],
        unvalidatedPlans: [],
      },
      now,
    );
    expect(r.alerts).toHaveLength(0);
    expect(r.locks).toHaveLength(0);
  });
});
