// Contratos compartilhados entre API e Web (DTOs, enums espelhados, sessão).

export const ROLES = [
  'COLABORADOR',
  'LIDER',
  'GESTOR',
  'RH',
  'JURIDICO',
  'CEO',
  'ADMIN',
] as const;
export type Role = (typeof ROLES)[number];

export interface SessionUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: Role;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: SessionUser;
}

/** As 5 dimensões do ICD. */
export const ICD_DIMENSIONS = ['clareza', 'pressao', 'confianca', 'influencia', 'risco'] as const;
export type IcdDimension = (typeof ICD_DIMENSIONS)[number];

export const DOMINANT_PATTERNS = ['PRESSAO', 'AUTOIMAGEM', 'CONFORMIDADE', 'AMEACA', 'EQUILIBRADO'] as const;
export type DominantPattern = (typeof DOMINANT_PATTERNS)[number];

export interface IcdQuestion {
  id: number;
  dimension: IcdDimension;
  text: string;
  /** true = valor alto na escala indica MENOR coerência (será invertido no cálculo). */
  inverse: boolean;
}

/**
 * Catálogo oficial: 10 perguntas, 2 por dimensão, aplicadas a uma decisão real.
 * Escala Likert 1–5. pressao e risco são inversas (quanto maior, pior a coerência).
 */
export const ICD_QUESTIONS: IcdQuestion[] = [
  { id: 1, dimension: 'clareza', text: 'Eu tinha clareza sobre o objetivo ao tomar a decisão.', inverse: false },
  { id: 2, dimension: 'clareza', text: 'As informações disponíveis eram suficientes para decidir.', inverse: false },
  { id: 3, dimension: 'pressao', text: 'Senti pressão de tempo ou cobrança ao decidir.', inverse: true },
  { id: 4, dimension: 'pressao', text: 'A decisão foi tomada sob estresse ou urgência.', inverse: true },
  { id: 5, dimension: 'confianca', text: 'Eu confiava na minha capacidade de tomar essa decisão.', inverse: false },
  { id: 6, dimension: 'confianca', text: 'Assumi a responsabilidade pela decisão sem hesitar.', inverse: false },
  { id: 7, dimension: 'influencia', text: 'Dependi da aprovação de outros para decidir.', inverse: true },
  { id: 8, dimension: 'influencia', text: 'Evitei contrariar expectativas alheias ao decidir.', inverse: true },
  { id: 9, dimension: 'risco', text: 'Senti medo das consequências negativas da decisão.', inverse: true },
  { id: 10, dimension: 'risco', text: 'Decidi mais para evitar uma ameaça do que para buscar um ganho.', inverse: true },
];

export interface IcdAnswer {
  questionId: number;
  value: number; // 1–5
}

export type IcdDimensions = Record<IcdDimension, number>; // 0–100 (normalizado p/ coerência)

export interface IcdResult {
  score: number; // 0–100
  dimensions: IcdDimensions;
  dominantPattern: DominantPattern;
}

export interface SubmitIcdRequest {
  leaderId: string;
  cycleId?: string;
  answers: IcdAnswer[];
}
