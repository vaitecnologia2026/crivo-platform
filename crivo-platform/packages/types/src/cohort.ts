/**
 * Recortes do colaborador ("cohort") — Ajustes Finais de Homologação, seção
 * Colaboradores/CSV.
 *
 * O cadastro ganha Unidade, Área, Setor, Cargo/Função, Turno, GHE/Grupo de
 * Exposição, Gestor e Modelo de trabalho; Sexo/Gênero e Ano de nascimento ou
 * Faixa etária são opcionais; a Geração é derivada pelo sistema. No envio da
 * resposta (anônima) o serviço copia SÓ estes atributos para a resposta — nunca
 * nome, CPF, e-mail ou telefone — e é por eles que o Dossiê e o portal agrupam,
 * sempre com a supressão por mínimo de respondentes.
 *
 * Regras fixas do cliente: GHE é informado pela empresa e NUNCA inferido (nem de
 * Área/Setor); "Processo" não entra no cadastro-base.
 */

export interface CollaboratorCohort {
  unit: string | null;
  area: string | null;
  sector: string | null;
  role: string | null;
  shift: string | null;
  ghe: string | null;
  manager: string | null;
  workModel: string | null;
  gender: string | null;
  ageBand: string | null;
  /** Derivada do ano de nascimento (ou estimada pela faixa etária). */
  generation: string | null;
}

export type CohortKey = keyof CollaboratorCohort;

/** Recortes disponíveis para análise, na ordem em que aparecem no portal. */
export const COHORT_DIMENSIONS: { key: CohortKey; label: string }[] = [
  { key: 'ghe', label: 'GHE / Grupo de exposição' },
  { key: 'unit', label: 'Unidade' },
  { key: 'area', label: 'Área' },
  { key: 'sector', label: 'Setor' },
  { key: 'role', label: 'Cargo/Função' },
  { key: 'shift', label: 'Turno' },
  { key: 'workModel', label: 'Modelo de trabalho' },
  { key: 'manager', label: 'Gestor' },
  { key: 'gender', label: 'Sexo/Gênero' },
  { key: 'ageBand', label: 'Faixa etária' },
  { key: 'generation', label: 'Geração' },
];

export const COHORT_LABEL: Record<CohortKey, string> = Object.fromEntries(
  COHORT_DIMENSIONS.map((d) => [d.key, d.label]),
) as Record<CohortKey, string>;

/** Listas fixas (com tolerância a variações no CSV — ver `normalizeShift`/`normalizeWorkModel`). */
export const SHIFTS = ['Manhã', 'Tarde', 'Noite', 'Rotativo', 'Administrativo'] as const;
export const WORK_MODELS = ['Presencial', 'Híbrido', 'Remoto'] as const;
/** Faixas etárias de 10 anos, as usuais em relatórios de RH. */
export const AGE_BANDS = ['até 24', '25–34', '35–44', '45–54', '55+'] as const;

const semAcento = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Texto vazio → null; senão o texto aparado. */
export function cohortText(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t : null;
}

/** "noite", "NOTURNO", "Noite " → "Noite"; o que não casar fica como veio. */
export function normalizeShift(v: unknown): string | null {
  const t = cohortText(v);
  if (!t) return null;
  const k = semAcento(t);
  if (/^(manha|matutino|diurno)$/.test(k)) return 'Manhã';
  if (/^(tarde|vespertino)$/.test(k)) return 'Tarde';
  if (/^(noite|noturno|madrugada)$/.test(k)) return 'Noite';
  if (/^(rotativo|revezamento|escala|turno rotativo)$/.test(k)) return 'Rotativo';
  if (/^(administrativo|adm|comercial|horario comercial)$/.test(k)) return 'Administrativo';
  return t;
}

/** "hibrido", "Home office", "presencial " → lista fixa; o que não casar fica como veio. */
export function normalizeWorkModel(v: unknown): string | null {
  const t = cohortText(v);
  if (!t) return null;
  const k = semAcento(t);
  if (/^(presencial|escritorio|fabrica|campo)$/.test(k)) return 'Presencial';
  if (/^(hibrido|misto|semi ?presencial)$/.test(k)) return 'Híbrido';
  if (/^(remoto|home ?office|teletrabalho|a distancia|distancia)$/.test(k)) return 'Remoto';
  return t;
}

/** Faixa etária de 10 anos a partir do ano de nascimento (idade no ano de referência). */
export function ageBandFromBirthYear(birthYear: number, referenceYear: number): string | null {
  if (!Number.isFinite(birthYear) || birthYear < 1900 || birthYear > referenceYear) return null;
  const age = referenceYear - birthYear;
  if (age <= 24) return 'até 24';
  if (age <= 34) return '25–34';
  if (age <= 44) return '35–44';
  if (age <= 54) return '45–54';
  return '55+';
}

/** Aceita as faixas oficiais e variações do CSV ("25-34", "25 a 34", "55 ou mais"). */
export function normalizeAgeBand(v: unknown): string | null {
  const t = cohortText(v);
  if (!t) return null;
  const k = semAcento(t).replace(/\s+/g, ' ');
  if (/^(ate 24|ate 24 anos|<\s?25|menos de 25|-24|0-24|18-24)$/.test(k)) return 'até 24';
  const m = k.match(/^(\d{2})\s*(?:-|–|a|até|ate)\s*(\d{2})/);
  if (m) {
    const ini = Number(m[1]);
    if (ini >= 25 && ini <= 34) return '25–34';
    if (ini >= 35 && ini <= 44) return '35–44';
    if (ini >= 45 && ini <= 54) return '45–54';
    if (ini < 25) return 'até 24';
    return '55+';
  }
  if (/^(55\+|55 ou mais|55 e mais|acima de 55|mais de 54|55)/.test(k)) return '55+';
  return t;
}

/**
 * Geração pelo ano de nascimento — cortes do Pew Research Center, os mais
 * usados em pesquisa: Boomers ≤ 1964, X 1965–1980, Y (Millennials) 1981–1996,
 * Z 1997–2012, Alpha ≥ 2013.
 */
export function generationFromBirthYear(birthYear: number): string | null {
  if (!Number.isFinite(birthYear) || birthYear < 1900) return null;
  if (birthYear <= 1964) return 'Baby Boomer';
  if (birthYear <= 1980) return 'Geração X';
  if (birthYear <= 1996) return 'Geração Y';
  if (birthYear <= 2012) return 'Geração Z';
  return 'Geração Alpha';
}

/** Sem o ano, estima pela faixa etária (ponto médio da faixa no ano de referência). */
export function generationFromAgeBand(ageBand: string | null, referenceYear: number): string | null {
  const faixa = normalizeAgeBand(ageBand);
  if (!faixa) return null;
  const meio: Record<string, number> = { 'até 24': 21, '25–34': 30, '35–44': 40, '45–54': 50, '55+': 60 };
  const idade = meio[faixa];
  if (idade === undefined) return null;
  return generationFromBirthYear(referenceYear - idade);
}

/** O que a resposta guarda do colaborador — e nada além disso. */
export function buildCohort(
  c: {
    unit?: string | null;
    area?: string | null;
    sector?: string | null;
    role?: string | null;
    shift?: string | null;
    ghe?: string | null;
    manager?: string | null;
    workModel?: string | null;
    gender?: string | null;
    birthYear?: number | null;
    ageBand?: string | null;
  },
  referenceYear: number = new Date().getFullYear(),
): CollaboratorCohort {
  const birthYear = typeof c.birthYear === 'number' ? c.birthYear : null;
  const ageBand = birthYear ? ageBandFromBirthYear(birthYear, referenceYear) : normalizeAgeBand(c.ageBand);
  const generation = birthYear ? generationFromBirthYear(birthYear) : generationFromAgeBand(ageBand, referenceYear);
  return {
    unit: cohortText(c.unit),
    area: cohortText(c.area),
    sector: cohortText(c.sector),
    role: cohortText(c.role),
    shift: normalizeShift(c.shift),
    // GHE é o que a empresa informou — nunca derivado de setor/área.
    ghe: cohortText(c.ghe),
    manager: cohortText(c.manager),
    workModel: normalizeWorkModel(c.workModel),
    gender: cohortText(c.gender),
    ageBand,
    generation,
  };
}

/** true quando o retrato não tem nenhum recorte preenchido. */
export function cohortIsEmpty(c: Partial<CollaboratorCohort> | null | undefined): boolean {
  if (!c) return true;
  return COHORT_DIMENSIONS.every((d) => !c[d.key]);
}
