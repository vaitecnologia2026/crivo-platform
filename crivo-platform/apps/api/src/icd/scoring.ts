import {
  ICD_QUESTIONS,
  ICD_DIMENSIONS,
  type IcdAnswer,
  type IcdResult,
  type IcdDimension,
  type DominantPattern,
} from '@crivo/types';

/**
 * Cálculo do ICD (heurística v0 — a calibrar com dados reais na fase de analytics).
 *
 * Cada questão é normalizada para "coerência" 0–100:
 *  - questões positivas: (valor-1)/4
 *  - questões inversas (pressao, risco, influencia-dependência): (5-valor)/4
 * A dimensão é a média das suas questões; o ICD é a média das 5 dimensões.
 * O padrão dominante é o maior sinal de risco (menor coerência) entre os drivers.
 */
export function computeIcd(answers: IcdAnswer[]): IcdResult {
  const byId = new Map(answers.map((a) => [a.questionId, a.value]));

  const raw: Record<IcdDimension, number[]> = {
    clareza: [], pressao: [], confianca: [], influencia: [], risco: [],
  };

  for (const q of ICD_QUESTIONS) {
    const v = byId.get(q.id);
    if (v == null || !Number.isFinite(v) || v < 1 || v > 5) {
      throw new Error(`Resposta inválida ou ausente para a questão ${q.id}`);
    }
    const coherent = q.inverse ? 5 - v : v - 1; // 0–4
    raw[q.dimension].push((coherent / 4) * 100);
  }

  const dimensions = {} as Record<IcdDimension, number>;
  for (const d of ICD_DIMENSIONS) {
    const arr = raw[d];
    dimensions[d] = Math.round(arr.reduce((s, x) => s + x, 0) / arr.length);
  }

  const score = Math.round(
    ICD_DIMENSIONS.reduce((s, d) => s + dimensions[d], 0) / ICD_DIMENSIONS.length,
  );

  // Sinal de risco por driver (quanto MAIOR, pior).
  const signals = {
    PRESSAO: 100 - dimensions.pressao,
    AUTOIMAGEM: 100 - dimensions.confianca,
    CONFORMIDADE: 100 - dimensions.influencia,
    AMEACA: 100 - dimensions.risco,
  };

  // Sem driver relevante (alta coerência) → EQUILIBRADO; senão o maior sinal.
  const PATTERN_THRESHOLD = 25;
  const drivers = Object.keys(signals) as Exclude<DominantPattern, 'EQUILIBRADO'>[];
  const top = drivers.reduce((best, p) => (signals[p] > signals[best] ? p : best));
  const dominantPattern: DominantPattern =
    signals[top] <= PATTERN_THRESHOLD ? 'EQUILIBRADO' : top;

  return { score, dimensions, dominantPattern };
}
