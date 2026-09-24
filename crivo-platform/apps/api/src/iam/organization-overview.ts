import type { OrganizationOverview } from '@crivo/types';

/** O que o painel lê de cada colaborador cadastrado. */
export interface ColaboradorDoPainel {
  area: string | null;
  sector: string | null;
  unit: string | null;
  manager: string | null;
}

/** Acima disto, as menores áreas viram "Outras áreas" (o protótipo lista 7). */
export const MAX_AREAS_NA_DISTRIBUICAO = 7;
export const SEM_AREA = 'Área não informada';

const limpo = (v: string | null | undefined) => v?.trim() || null;
const chave = (v: string) => v.toLocaleLowerCase('pt-BR');

/** Área do colaborador: `area`; se só veio `sector` (cadastro antigo), ele. */
const areaDe = (c: ColaboradorDoPainel) => limpo(c.area) ?? limpo(c.sector);

/**
 * Agrupa sem diferenciar maiúsculas ("Operações" = "operações"), mantendo a
 * primeira grafia vista — o cadastro vem de CSV digitado à mão.
 */
function agrupar<T>(itens: T[], rotulo: (t: T) => string | null) {
  const grupos = new Map<string, { nome: string; itens: T[] }>();
  const sem: T[] = [];
  for (const it of itens) {
    const r = rotulo(it);
    if (!r) {
      sem.push(it);
      continue;
    }
    const g = grupos.get(chave(r)) ?? { nome: r, itens: [] };
    g.itens.push(it);
    grupos.set(chave(r), g);
  }
  const ordenados = [...grupos.values()].sort(
    (a, b) => b.itens.length - a.itens.length || a.nome.localeCompare(b.nome, 'pt-BR'),
  );
  return { grupos: ordenados, sem };
}

/** Percentuais inteiros que somam exatamente 100 (maior resto). */
export function percentuais(quantidades: number[]): number[] {
  const total = quantidades.reduce((s, q) => s + q, 0);
  if (total === 0) return quantidades.map(() => 0);
  const brutos = quantidades.map((q) => (q * 100) / total);
  const base = brutos.map(Math.floor);
  let falta = 100 - base.reduce((s, b) => s + b, 0);
  const ordem = brutos
    .map((b, i) => ({ i, resto: b - Math.floor(b) }))
    .sort((a, b) => b.resto - a.resto || a.i - b.i);
  for (const { i } of ordem) {
    if (falta <= 0) break;
    base[i] += 1;
    falta -= 1;
  }
  return base;
}

export function resumoDaOrganizacao(
  colaboradores: ColaboradorDoPainel[],
  cicloAtivo: string | null,
): OrganizationOverview {
  const porArea = agrupar(colaboradores, areaDe);

  let linhas = porArea.grupos.map((g) => ({ area: g.nome, people: g.itens.length }));
  if (linhas.length > MAX_AREAS_NA_DISTRIBUICAO + 1) {
    const resto = linhas.slice(MAX_AREAS_NA_DISTRIBUICAO);
    linhas = [
      ...linhas.slice(0, MAX_AREAS_NA_DISTRIBUICAO),
      { area: `Outras áreas (${resto.length})`, people: resto.reduce((s, l) => s + l.people, 0) },
    ];
  }
  if (porArea.sem.length > 0) linhas.push({ area: SEM_AREA, people: porArea.sem.length });
  const pct = percentuais(linhas.map((l) => l.people));

  const porUnidade = agrupar(colaboradores, (c) => limpo(c.unit));
  const units = porUnidade.grupos.map((g) => {
    const areas = new Set(g.itens.map(areaDe).filter((a): a is string => !!a).map(chave));
    const gestores = agrupar(g.itens, (c) => limpo(c.manager)).grupos;
    return {
      name: g.nome,
      people: g.itens.length,
      areas: areas.size,
      manager: gestores.length === 1 ? gestores[0].nome : null,
      managers: gestores.length,
    };
  });

  return {
    collaborators: colaboradores.length,
    areas: porArea.grupos.length,
    distribution: linhas.map((l, i) => ({ ...l, percent: pct[i] })),
    units,
    withoutUnit: porUnidade.sem.length,
    activeCycle: limpo(cicloAtivo),
  };
}
