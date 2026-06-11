import {
  ICD_QUESTIONS,
  ICD_DIMENSIONS,
  type IcdAnswer,
  type IcdResult,
  type IcdDimension,
  type DominantTension,
} from '@crivo/types';

/**
 * Cálculo do ICD (heurística v0 — a calibrar com dados reais). Modelo dos 4 Rs:
 * Reatividade, Rigidez, Repercussão, Risco. 8 perguntas (2 por R), escala 1–5,
 * todas inversas: quanto MAIOR o valor, MAIOR a tensão (menor a coerência).
 *
 * Coerência por questão (0–100) = (5 - valor) / 4 * 100. A dimensão é a média
 * das suas questões; o ICD é a média dos 4 Rs. A TENSÃO DOMINANTE é o R com
 * maior tensão (menor coerência) — ou EQUILIBRADO se nenhum se destaca.
 * Não há "padrão mental"; é leitura da coerência decisória sob pressão.
 */
const TENSION_OF: Record<IcdDimension, Exclude<DominantTension, 'EQUILIBRADO'>> = {
  reatividade: 'REATIVIDADE',
  rigidez: 'RIGIDEZ',
  repercussao: 'REPERCUSSAO',
  risco: 'RISCO',
};

export function computeIcd(answers: IcdAnswer[]): IcdResult {
  const byId = new Map(answers.map((a) => [a.questionId, a.value]));

  const raw: Record<IcdDimension, number[]> = {
    reatividade: [], rigidez: [], repercussao: [], risco: [],
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

  // Tensão por R (quanto MAIOR, pior). EQUILIBRADO se nenhum passa o limiar.
  const TENSION_THRESHOLD = 25;
  const topR = ICD_DIMENSIONS.reduce((best, d) =>
    100 - dimensions[d] > 100 - dimensions[best] ? d : best,
  );
  const dominantPattern: DominantTension =
    100 - dimensions[topR] <= TENSION_THRESHOLD ? 'EQUILIBRADO' : TENSION_OF[topR];

  return { score, dimensions, dominantPattern };
}
