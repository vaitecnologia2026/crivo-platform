import { describe, it, expect } from "vitest";
import { computeIcd } from "./scoring";
import { ICD_QUESTIONS } from "@crivo/types";

/**
 * Cobertura do modelo LEGADO de ICD (4 Rs). Vive em apps/api/src/icd/scoring.ts
 * porque o modelo OFICIAL agora é 4 Eixos (testes em @crivo/types).
 *
 * As 8 perguntas ICD_QUESTIONS são todas "inversas: true" — valor 1 na Likert
 * indica MENOR tensão = MAIOR coerência. Score 100 = excelente coerência.
 */

describe("computeIcd (4 Rs — legacy)", () => {
  it("score 100 quando todas as respostas são 1 (menor tensão)", () => {
    const answers = ICD_QUESTIONS.map((q) => ({ questionId: q.id, value: 1 }));
    const r = computeIcd(answers);
    expect(r.score).toBe(100);
    expect(r.dimensions.reatividade).toBe(100);
    expect(r.dimensions.rigidez).toBe(100);
    expect(r.dimensions.repercussao).toBe(100);
    expect(r.dimensions.risco).toBe(100);
    expect(r.dominantPattern).toBe("EQUILIBRADO");
  });

  it("score 0 quando todas as respostas são 5 (máxima tensão)", () => {
    const answers = ICD_QUESTIONS.map((q) => ({ questionId: q.id, value: 5 }));
    const r = computeIcd(answers);
    expect(r.score).toBe(0);
    expect(r.dominantPattern).not.toBe("EQUILIBRADO");
  });

  it("detecta REATIVIDADE quando P1,P2=5 e resto=1", () => {
    const answers = ICD_QUESTIONS.map((q) => ({
      questionId: q.id,
      value: q.dimension === "reatividade" ? 5 : 1,
    }));
    const r = computeIcd(answers);
    expect(r.dominantPattern).toBe("REATIVIDADE");
    expect(r.dimensions.reatividade).toBe(0); // pior coerência
    expect(r.dimensions.rigidez).toBe(100);
  });

  it("detecta RIGIDEZ quando só P3,P4 estão tensos", () => {
    const answers = ICD_QUESTIONS.map((q) => ({
      questionId: q.id,
      value: q.dimension === "rigidez" ? 5 : 1,
    }));
    expect(computeIcd(answers).dominantPattern).toBe("RIGIDEZ");
  });

  it("recusa resposta fora 1-5", () => {
    const answers = ICD_QUESTIONS.map((q) => ({ questionId: q.id, value: 6 }));
    expect(() => computeIcd(answers)).toThrow();
  });

  it("recusa quando faltam respostas", () => {
    expect(() => computeIcd([{ questionId: 1, value: 3 }])).toThrow();
  });
});
