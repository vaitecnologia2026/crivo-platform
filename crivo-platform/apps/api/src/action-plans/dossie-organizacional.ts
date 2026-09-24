import {
  PSYCHOSOCIAL_RISK_CLASS_LABEL,
  nomeDoGhe,
  rotuloDoGhe,
  type PsychosocialRiskClass,
  type PsychosocialRiskMatrixRow,
} from '@crivo/types';

/**
 * Peças do Dossiê Técnico no modelo OFICIAL de 23/09
 * (CRIVO_Dossie_Tecnico_Organizacional_OFICIAL_DEFINITIVO_23Set2026.pdf).
 *
 * Funções PURAS: recebem a matriz já calculada (Resultado Geral e cada GHE) e
 * as ações APROVADAS do Plano de Evolução, e devolvem o texto/HTML das seções.
 * Ficam fora do DocumentsService para que o conteúdo do documento seja testado
 * contra o PDF-modelo sem banco — a homologação compara texto e número.
 *
 * Regras do modelo que moram aqui:
 * - UM Plano de Evolução; cada ação tem escopo (Organização ou GHE). As gerais
 *   são numeradas primeiro (PA-001…), na ordem das prioridades do Resultado
 *   Geral; as específicas de GHE vêm depois, na ordem do panorama.
 * - Ação geral NÃO se repete como ação de GHE: ela é REFERENCIADA no anexo de
 *   cada GHE em que o fator dela exige ação (R >= 10 na matriz do PRÓPRIO GHE).
 * - Quebra de página é natural; o anexo de fatores se divide em partes só para
 *   repetir o título, como no modelo, sem número fixo de páginas.
 */

/** Cores das classes de risco no modelo oficial (matriz 5×5 e células do
 *  anexo por GHE) — extraídas do PDF-modelo. */
export const COR_CLASSE_RISCO: Record<PsychosocialRiskClass, string> = {
  BAIXO: '#57B35B',
  MODERADO: '#F3C431',
  ALTO: '#F58B3A',
  MUITO_ALTO: '#E74B3B',
  CRITICO: '#C7352C',
};

const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Número com casas FIXAS e vírgula decimal — "72,3", "3,58", "57,9". */
export function decimalPtBr(v: number, casas: number): string {
  return v.toFixed(casas).replace('.', ',');
}

/** "a", "a e b", "a, b e c" — como o modelo junta os fatores na prosa. */
export function listaPtBr(itens: string[]): string {
  if (itens.length <= 1) return itens[0] ?? '';
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}

/**
 * Data dd/mm/aaaa. INSTANTE (emissão, resposta, validação) sai no fuso de
 * Brasília — o servidor roda em UTC e, à noite, a emissão saía datada do dia
 * seguinte. Valor exatamente à meia-noite UTC é um DIA sem hora (prazo digitado
 * "AAAA-MM-DD", data da devolutiva) e sai em UTC: no fuso de Brasília ele
 * voltava para o dia anterior (23/10 virava 22/10).
 */
export function dataPtBr(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '—';
  const soDia =
    x.getUTCHours() === 0 && x.getUTCMinutes() === 0 && x.getUTCSeconds() === 0 && x.getUTCMilliseconds() === 0;
  return x.toLocaleDateString('pt-BR', { timeZone: soDia ? 'UTC' : 'America/Sao_Paulo' });
}

/** Linha da matriz que estas peças usam. */
export type LinhaMatriz = Pick<
  PsychosocialRiskMatrixRow,
  'slug' | 'label' | 'probability' | 'severity' | 'risk' | 'riskClass' | 'planRequired' | 'exposureAvg'
> & { code?: string | null };

/** Ação do Plano de Evolução como o Dossiê lê. */
export type AcaoPlano = {
  point: string;
  action: string;
  objective?: string | null;
  responsible: string | null;
  dueDate: Date | string | null;
  indicator?: string | null;
  expectedEvidence: string | null;
  riskFactorSlug?: string | null;
  scopeGhe?: string | null;
};

export type AcaoNumerada<T extends AcaoPlano = AcaoPlano> = {
  acao: T;
  /** "PA-001" — posição no documento, congelada na emissão. */
  pa: string;
  fatorSlug: string | null;
  fatorCodigo: string;
  fatorLabel: string;
  /** null = Resultado Geral da Organização. */
  ghe: string | null;
};

const norm = (s: string) => s.trim().toLowerCase();

/** Fator da ação: pelo vínculo gravado (sugestão da matriz) ou, na ação manual,
 *  pelo nome — a mesma regra do gate de emissão (`bloqueiosDoPlano`). */
function fatorDaAcao(a: AcaoPlano, linhas: LinhaMatriz[]): LinhaMatriz | undefined {
  return (
    (a.riskFactorSlug ? linhas.find((l) => l.slug === a.riskFactorSlug) : undefined) ??
    linhas.find((l) => norm(l.label) === norm(a.point))
  );
}

/**
 * Numera as ações APROVADAS no formato do modelo: gerais primeiro, na ordem das
 * PRIORIDADES do Resultado Geral (a matriz já vem por R decrescente, empate
 * pela ordem do catálogo); ação de fator fora da matriz vai para o fim das
 * gerais. Depois as específicas de cada GHE, na ordem do panorama e, dentro do
 * GHE, na ordem da matriz do próprio grupo. Por último, ação de GHE que não
 * está no panorama (grupo abaixo do mínimo ou renomeado). Empate mantém a
 * ordem de criação — a lista chega ordenada por `createdAt`.
 */
export function numerarAcoes<T extends AcaoPlano>(
  aprovadas: T[],
  matrizGeral: LinhaMatriz[],
  ghesEmOrdem: string[],
  matrizDoGhe: (ghe: string) => LinhaMatriz[],
  codigoDe: (slug: string) => string,
): AcaoNumerada<T>[] {
  const posicao = (lista: LinhaMatriz[], slug: string | null) => {
    const i = slug ? lista.findIndex((l) => l.slug === slug) : -1;
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const resolver = (a: T): { slug: string | null; codigo: string; label: string } => {
    const escopo = a.scopeGhe ? matrizDoGhe(a.scopeGhe) : [];
    const l = fatorDaAcao(a, matrizGeral) ?? fatorDaAcao(a, escopo);
    return l
      ? { slug: l.slug, codigo: codigoDe(l.slug), label: l.label }
      : { slug: a.riskFactorSlug ?? null, codigo: '—', label: a.point };
  };

  const gerais = aprovadas
    .filter((a) => !a.scopeGhe)
    .map((a) => ({ a, f: resolver(a) }))
    .sort((x, y) => posicao(matrizGeral, x.f.slug) - posicao(matrizGeral, y.f.slug));

  const especificas: { a: T; f: ReturnType<typeof resolver> }[] = [];
  const noPanorama = new Set(ghesEmOrdem);
  for (const ghe of ghesEmOrdem) {
    const m = matrizDoGhe(ghe);
    especificas.push(
      ...aprovadas
        .filter((a) => a.scopeGhe === ghe)
        .map((a) => ({ a, f: resolver(a) }))
        .sort((x, y) => posicao(m, x.f.slug) - posicao(m, y.f.slug)),
    );
  }
  const orfas = aprovadas
    .filter((a) => a.scopeGhe && !noPanorama.has(a.scopeGhe))
    .map((a) => ({ a, f: resolver(a) }))
    .sort((x, y) => nomeDoGhe(x.a.scopeGhe!).localeCompare(nomeDoGhe(y.a.scopeGhe!), 'pt-BR'));

  return [...gerais, ...especificas, ...orfas].map(({ a, f }, i) => ({
    acao: a,
    pa: `PA-${String(i + 1).padStart(3, '0')}`,
    fatorSlug: f.slug,
    fatorCodigo: f.codigo,
    fatorLabel: f.label,
    ghe: a.scopeGhe ?? null,
  }));
}

/** "PA-001 - Resultado Geral da Organização - RPS-001 - Sobrecarga de trabalho". */
export function tituloDaAcao(a: AcaoNumerada): string {
  const escopo = a.ghe ? rotuloDoGhe(a.ghe) : 'Resultado Geral da Organização';
  return [a.pa, escopo, ...(a.fatorCodigo !== '—' ? [a.fatorCodigo] : []), a.fatorLabel].join(' - ');
}

/**
 * Card de UMA ação aprovada, como no modelo: título em negrito, Medida,
 * Objetivo e dois pares lado a lado (Responsável | Prazo, Acompanhamento |
 * Evidência esperada), com filete lateral. Todo texto variável é escapado.
 */
export function cardAcaoHtml(a: AcaoNumerada): string {
  const x = a.acao;
  // Medidas do modelo: texto 8pt, título 9,3pt, borda 0,45pt e filete de 2,2pt.
  const par = (rotulo: string, valor: string) =>
    `<td style="width:50%;padding:2pt 10pt 2pt 0;vertical-align:top;border:0;font-size:8pt">` +
    `<b>${esc(rotulo)}:</b> ${esc(valor)}</td>`;
  const linha = (rotulo: string, valor: string) =>
    `<p style="margin:0 0 5pt;font-size:8pt"><b>${esc(rotulo)}:</b> ${esc(valor)}</p>`;
  return (
    '<div style="border:0.45pt solid #D8D1C5;border-left:2.2pt solid #B56E2E;padding:6pt 9pt 4pt;' +
    'margin:0 0 7pt;break-inside:avoid;page-break-inside:avoid">' +
    `<div style="font-weight:700;font-size:9.3pt;color:#14253F;margin:0 0 5pt">${esc(tituloDaAcao(a))}</div>` +
    linha('Medida', x.action) +
    linha('Objetivo', x.objective?.trim() || '—') +
    '<table style="width:100%;border-collapse:collapse;margin:0">' +
    `<tr>${par('Responsável da empresa', x.responsible?.trim() || '—')}${par('Prazo', dataPtBr(x.dueDate))}</tr>` +
    `<tr>${par('Acompanhamento', x.indicator?.trim() || '—')}` +
    `${par('Evidência esperada', x.expectedEvidence?.trim() || '—')}</tr>` +
    '</table></div>'
  );
}

/** Fatores com R >= 10 (plano obrigatório) de uma matriz, na ordem do CÓDIGO —
 *  é como o modelo os lista na leitura e no anexo de cada GHE. */
export function fatoresQueRequeremAcao(
  matriz: LinhaMatriz[],
  codigoDe: (slug: string) => string,
): LinhaMatriz[] {
  return matriz
    .filter((r) => r.planRequired)
    .sort((a, b) => codigoDe(a.slug).localeCompare(codigoDe(b.slug), 'pt-BR'));
}

/** Maior risco técnico da matriz ("—" sem matriz). */
export function maiorRisco(matriz: LinhaMatriz[]): string {
  return matriz.length ? String(Math.max(...matriz.map((r) => r.risk))) : '—';
}

/** Ações GERAIS que valem para o GHE: as do fator que exige ação NA MATRIZ DO
 *  PRÓPRIO GHE. Ordem de PA. */
export function acoesGeraisDoGhe(numeradas: AcaoNumerada[], fatoresDoGhe: LinhaMatriz[]): AcaoNumerada[] {
  const slugs = new Set(fatoresDoGhe.map((f) => f.slug));
  return numeradas.filter((a) => !a.ghe && a.fatorSlug && slugs.has(a.fatorSlug));
}

export function acoesEspecificasDoGhe(numeradas: AcaoNumerada[], ghe: string): AcaoNumerada[] {
  return numeradas.filter((a) => a.ghe === ghe);
}

/**
 * "Leitura técnica do ciclo" de um GHE no panorama: os fatores que requerem
 * ação (com o R do próprio grupo) e como o grupo está coberto. Fator sem
 * nenhuma ação aprovada aplicável é DITO — a emissão oficial fica bloqueada
 * nesse caso, mas a pré-visualização não pode fingir cobertura.
 */
export function leituraDoGhe(
  fatores: LinhaMatriz[],
  gerais: AcaoNumerada[],
  especificas: AcaoNumerada[],
): string {
  if (!fatores.length) {
    return 'Nenhum fator com R >= 10 no grupo neste ciclo.';
  }
  const partes = [
    `${listaPtBr(fatores.map((f) => `${f.label} (R=${f.risk})`))} ${fatores.length === 1 ? 'requer' : 'requerem'} ação.`,
  ];
  const cobertos = new Set([...gerais, ...especificas].map((a) => a.fatorSlug));
  const descobertos = fatores.filter((f) => !cobertos.has(f.slug));
  const n = especificas.length;
  if (n === 0) {
    if (gerais.length) partes.push('As medidas gerais aprovadas abrangem este grupo.');
  } else {
    const especifica =
      n === 1 ? 'uma ação específica aprovada' : `${n} ações específicas aprovadas`;
    partes.push(
      gerais.length
        ? `Além das medidas gerais, há ${especifica} para o grupo.`
        : `Há ${especifica} para o grupo.`,
    );
  }
  if (descobertos.length) {
    partes.push(`Sem ação aprovada aplicável: ${listaPtBr(descobertos.map((f) => f.label))}.`);
  }
  return partes.join(' ');
}

/** Um grupo já calculado para o panorama e o anexo. */
export type GrupoCalculado = {
  ghe: string;
  n: number;
  score: number;
  faixa: string;
  matriz: LinhaMatriz[];
};

/** Tabela "Resultado Geral e panorama dos GHEs". */
export function tabelaPanorama(
  geral: { n: number; score: number; faixa: string; matriz: LinhaMatriz[] },
  ghes: GrupoCalculado[],
  numeradas: AcaoNumerada[],
  casas: number,
): { columns: string[]; data: string[][] } {
  const nGerais = numeradas.filter((a) => !a.ghe).length;
  const r10 = (m: LinhaMatriz[]) => String(m.filter((r) => r.planRequired).length);
  return {
    columns: ['Escopo / GHE', 'n', 'Score', 'Faixa', 'Fatores R >= 10', 'Maior R', 'Ações específicas'],
    data: [
      [
        'Resultado Geral da Organização',
        String(geral.n),
        decimalPtBr(geral.score, casas),
        geral.faixa,
        r10(geral.matriz),
        maiorRisco(geral.matriz),
        `${nGerais} ${nGerais === 1 ? 'ação geral' : 'ações gerais'}`,
      ],
      ...ghes.map((g) => [
        nomeDoGhe(g.ghe),
        String(g.n),
        decimalPtBr(g.score, casas),
        g.faixa,
        r10(g.matriz),
        maiorRisco(g.matriz),
        String(acoesEspecificasDoGhe(numeradas, g.ghe).length),
      ]),
    ],
  };
}

/** "Fatores que requerem ação" do anexo do GHE — R e Classificação pintados
 *  com a cor da classe, como no modelo. Mesmas classes CSS da tabela comum. */
export function tabelaFatoresDoGheHtml(fatores: LinhaMatriz[], codigoDe: (slug: string) => string): string {
  const cab = ['ID', 'Fator', 'Exposição', 'P', 'S', 'R', 'Classificação']
    .map((c) => `<th>${esc(c)}</th>`)
    .join('');
  const linhas = fatores
    .map((f) => {
      const cor = `background:${COR_CLASSE_RISCO[f.riskClass]}`;
      return (
        `<tr><td>${esc(codigoDe(f.slug))}</td><td>${esc(f.label)}</td>` +
        `<td>${esc(decimalPtBr(f.exposureAvg, 2))}</td><td>${f.probability}</td><td>${f.severity}</td>` +
        `<td style="${cor}">${f.risk}</td>` +
        `<td style="${cor}">${esc(PSYCHOSOCIAL_RISK_CLASS_LABEL[f.riskClass])}</td></tr>`
      );
    })
    .join('');
  return `<table class="grid"><thead><tr>${cab}</tr></thead><tbody>${linhas}</tbody></table>`;
}

/** Linhas do anexo em partes: o título se repete a cada parte, como no modelo
 *  (40 fatores → parte 1 e parte 2). Até `tamanho`, uma parte só, sem sufixo. */
export function emPartes<T>(itens: T[], tamanho = 20): T[][] {
  if (itens.length <= tamanho) return [itens];
  const out: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) out.push(itens.slice(i, i + tamanho));
  return out;
}

/** Síntese executiva automática, com o negrito do modelo no score e nos
 *  fatores. HTML escapado — o texto aprovado pela equipe segue como `body`. */
export function sinteseExecutivaHtml(
  scoreTexto: string,
  faixa: string,
  prioritarios: string[],
  /** Fatores que requerem ação SÓ na matriz de algum GHE ("Fator (GHE - X)"). */
  soNosGhes: string[] = [],
): string {
  const b = (s: string) => `<strong>${esc(s)}</strong>`;
  const fatores = prioritarios.length
    ? `A priorização técnica identifica ${listaPtBr(prioritarios.map(b))} como ` +
      `${prioritarios.length === 1 ? 'fator que requer' : 'fatores que requerem'} plano de ação ` +
      'pela metodologia CRIVO. '
    : soNosGhes.length
      ? 'No Resultado Geral, a priorização técnica não identificou fatores que requeiram plano de ' +
        'ação pela metodologia CRIVO. '
      : 'A priorização técnica não identificou fatores que requeiram plano de ação pela metodologia CRIVO. ';
  // Sem isto o documento se contradizia: a síntese dizia "nenhum fator" e o
  // anexo do GHE listava fator com R >= 10 (e a emissão cobrava ação dele).
  const ghes = soNosGhes.length
    ? `Nos GHEs, ${listaPtBr(soNosGhes.map(b))} ${soNosGhes.length === 1 ? 'requer' : 'requerem'} ` +
      'ação no próprio grupo. '
    : '';
  return (
    `<p>O ciclo apresenta score executivo geral de ${b(`${scoreTexto} (${faixa})`)}. ${fatores}${ghes}` +
    'O score executivo e a classificação técnica de risco são leituras distintas.</p>'
  );
}
