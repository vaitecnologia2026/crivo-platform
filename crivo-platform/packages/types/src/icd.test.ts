import { describe, it, expect } from "vitest";
import {
  // 4 Eixos (Anexo §6-§9)
  computeDecisionIcd,
  icdAxisValueToScore,
  // Diagnóstico Inicial (Briefing §5 — pré-diagnóstico da LP)
  computePreDiagnostic,
  PRE_DIAGNOSTIC_QUESTIONS,
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
