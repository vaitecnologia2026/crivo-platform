/**
 * HTML dos modelos de relatório: saneamento e marcação automática.
 *
 * O modelo importado do Word guarda o HTML FIEL do arquivo (títulos, tabelas,
 * listas, negrito e imagens). Como esse HTML nasce de um arquivo enviado por
 * terceiro e depois é renderizado no navegador do cliente, ele NUNCA pode ir ao
 * banco sem passar por `sanitizeReportHtml` — é o único portão contra XSS neste
 * caminho.
 *
 * A marcação automática roda UMA VEZ, na importação (não na geração): os blocos
 * de exemplo do arquivo (grade de identificação, tabela de dimensões, matriz,
 * plano) viram marcadores `{{chave}}`, que o admin revisa antes de salvar. É o
 * que torna a detecção confiável — em vez de adivinhar a cada emissão.
 */

/** Tags preservadas, com os atributos aceitos em cada uma. */
const ALLOWED: Record<string, string[]> = {
  p: [],
  br: [],
  strong: [],
  b: [],
  em: [],
  i: [],
  u: [],
  s: [],
  h1: [],
  h2: [],
  h3: [],
  h4: [],
  h5: [],
  h6: [],
  ul: [],
  ol: ['start'],
  li: [],
  table: ['class'],
  thead: [],
  tbody: [],
  tfoot: [],
  tr: [],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan'],
  a: ['href'],
  img: ['src', 'alt'],
  sup: [],
  sub: [],
  blockquote: [],
  hr: [],
  pre: [],
  code: [],
  span: [],
};

const VOID_TAGS = new Set(['br', 'img', 'hr']);

/** Tags descartadas COM o conteúdo (não basta remover a tag). */
const DROP_WITH_CONTENT = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'svg',
  'math',
  'noscript',
  'template',
  'link',
  'meta',
  'head',
  'base',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'audio',
  'video',
  'source',
  'canvas',
  'applet',
  'frame',
  'frameset',
]);

function escapeAttrValue(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Mantém só os atributos da allowlist, validando href/src pelo esquema. */
function cleanAttrs(tag: string, raw: string): { attrs: string; dropTag: boolean } {
  const allowed = ALLOWED[tag];
  if (!allowed.length) return { attrs: '', dropTag: false };

  const out: string[] = [];
  const seen = new Set<string>();
  const re = /([a-zA-Z_:][a-zA-Z0-9_:.-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const key = m[1].toLowerCase();
    if (!allowed.includes(key) || seen.has(key)) continue;
    const value = (m[3] ?? m[4] ?? m[5] ?? '').trim();
    // Link só http(s)/mailto: bloqueia javascript:, data:text/html e vbscript:.
    if (key === 'href' && !/^(https?:\/\/|mailto:)/i.test(value)) continue;
    // Imagem só embutida (o import converte o binário do .docx em data URI).
    if (key === 'src' && !/^data:image\/(png|jpe?g|gif|webp|bmp);base64,[A-Za-z0-9+/=\s]+$/i.test(value)) continue;
    // Unica classe aceita: a marca de tabela COM borda no Word. Valor livre em
    // class seria um vetor de estilo injetado no documento do cliente.
    if (key === 'class' && value !== 'mdl-grid' && value !== 'mdl-rows') continue;
    if (key === 'colspan' || key === 'rowspan' || key === 'start') {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1 || n > 100) continue;
    }
    seen.add(key);
    out.push(`${key}="${escapeAttrValue(value)}"`);
  }
  // <img> sem src válido não tem função no documento — a tag inteira sai.
  const dropTag = tag === 'img' && !seen.has('src');
  return { attrs: out.length ? ` ${out.join(' ')}` : '', dropTag };
}

/**
 * Allowlist estrita: tag fora da lista é removida (o texto dentro dela
 * permanece); tag perigosa é removida COM o conteúdo; todo atributo não
 * listado — inclusive qualquer `on*` — desaparece.
 */
export function sanitizeReportHtml(input: string): string {
  const src = String(input ?? '');
  const re = /<!--[\s\S]*?-->|<![^>]*>|<\/?([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
  let out = '';
  let last = 0;
  let skipTag = '';
  let m: RegExpExecArray | null;

  while ((m = re.exec(src)) !== null) {
    if (!skipTag) out += src.slice(last, m.index);
    last = re.lastIndex;

    const raw = m[0];
    if (raw.startsWith('<!')) continue; // comentário ou doctype: descartados
    const name = (m[1] ?? '').toLowerCase();
    const closing = raw.startsWith('</');

    if (skipTag) {
      if (closing && name === skipTag) skipTag = '';
      continue;
    }
    if (DROP_WITH_CONTENT.has(name)) {
      const selfClosing = /\/\s*>$/.test(raw);
      if (!closing && !selfClosing) skipTag = name;
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(ALLOWED, name)) continue;
    if (closing) {
      if (!VOID_TAGS.has(name)) out += `</${name}>`;
      continue;
    }
    const { attrs, dropTag } = cleanAttrs(name, m[2] ?? '');
    if (dropTag) continue;
    out += VOID_TAGS.has(name) ? `<${name}${attrs}/>` : `<${name}${attrs}>`;
  }
  if (!skipTag) out += src.slice(last);
  return out.trim();
}

// ── Marcação automática dos blocos dinâmicos ─────────────────────────────────

/** Texto plano de um trecho de HTML (para casar rótulos de cabeçalho). */
function plainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Cabeçalho da tabela (primeira linha) — é ele que diz o que a tabela É. */
function tableHeader(table: string): string[] {
  const first = table.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/i)?.[0] ?? '';
  return (first.match(/<t[dh]\b[^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []).map(plainText);
}

/** Primeira coluna — tabela de pares rótulo/valor não tem cabeçalho. */
function tableFirstColumn(table: string): string[] {
  const rows = table.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  return rows.map((r) => plainText((r.match(/<t[dh]\b[^>]*>[\s\S]*?<\/t[dh]>/i) ?? [''])[0]));
}

const has = (campos: string[], re: RegExp) => campos.some((c) => re.test(c));

/**
 * Regra de reconhecimento de uma tabela de exemplo → marcador que a substitui.
 * Decide pelo CABEÇALHO e pela primeira coluna, nunca pelo texto inteiro: um
 * parágrafo que só EXPLICA "Probabilidade (1-5)... Severidade (1-5)..." não é a
 * matriz, e trocá-lo por {{matriz_risco}} apagava a explicação e deixava a
 * matriz de verdade como texto fixo.
 */
type TableRule = { key: string; test: (h: string[], col1: string[]) => boolean };

/**
 * Tabela que NÃO deve virar marcador, mesmo casando com alguma regra: o
 * inventário técnico tem P/S/R como a matriz, mas carrega caracterização,
 * agravos e medidas existentes, que o motor não gera.
 */
function isInventario(h: string[]): boolean {
  return has(h, /(caracteriza[çc][ãa]o|poss[íi]veis agravos|medidas existentes|processo \s?\/?\s?ambiente|atividade \s?\/?\s?tarefa)/i);
}

const TABLE_RULES: TableRule[] = [
  {
    // Matriz: colunas curtas de calculo (P, S, R) ou os nomes por extenso.
    key: 'matriz_risco',
    test: (h) =>
      !isInventario(h) &&
      has(h, /^(p|prob\.?|probabilidade)$/i) &&
      has(h, /^(s|sev\.?|severidade)$/i) &&
      has(h, /^(r|risco|classifica[çc][ãa]o|a[çc][ãa]o recomendada)$/i),
  },
  {
    key: 'assinaturas',
    test: (h) => has(h, /assinatura/i) && has(h, /(respons[áa]vel|nome|cargo)/i),
  },
  {
    key: 'controle_documental',
    test: (h, c) =>
      has([...h, ...c], /(hash|id do documento|identificador do documento)/i) &&
      has([...h, ...c], /(vers[ãa]o|status|emiss[ãa]o)/i),
  },
  {
    key: 'tabela_dimensoes',
    test: (h) => has(h, /^dimens(?:[ãa]o|[õo]es)$/i) && has(h, /^([íi]ndice|score|pontua[çc][ãa]o|resultado|faixa)/i),
  },
  {
    key: 'participacao',
    test: (h) => has(h, /^(setor|[áa]rea|grupo)/i) && has(h, /^(respondentes|respostas|participa[çc][ãa]o|ades[ãa]o)/i),
  },
  {
    key: 'plano_acao',
    test: (h) =>
      has(h, /(medida|a[çc][ãa]o|ponto de aten[çc][ãa]o)/i) && has(h, /(respons[áa]vel|prazo|status|acompanhamento)/i),
  },
  {
    // Identificacao: pares rotulo/valor com a empresa e ao menos um dado do ciclo.
    key: 'identificacao',
    test: (h, c) =>
      has([...h, ...c], /^(empresa|organiza[çc][ãa]o|raz[ãa]o social)/i) &&
      has([...h, ...c], /(cnpj|respondente|^data|data de emiss[ãa]o|m[ée]todo aplicado|estabelecimento|per[íi]odo)/i),
  },
];

/** Rótulo em texto corrido ("Empresa: X") → marcador do valor. */
const INLINE_LABELS: { re: RegExp; key: string }[] = [
  { re: /^(empresa|organiza[çc][ãa]o|raz[ãa]o social)$/i, key: 'empresa' },
  { re: /^cnpj$/i, key: 'cnpj' },
  { re: /^(data de emiss[ãa]o|data do relat[óo]rio|data)$/i, key: 'data_emissao' },
  { re: /^(m[ée]todo aplicado|diagn[óo]stico aplicado|m[ée]todo|instrumento)$/i, key: 'diagnostico' },
  { re: /^(respondentes|respostas v[áa]lidas|total de respondentes)$/i, key: 'respondentes' },
  { re: /^(sa[íi]da t[ée]cnica)$/i, key: 'saida_tecnica' },
];

/** Linha de tabela "Rótulo | valor" cujo VALOR é calculado pelo motor. */
const ROW_LABELS: { re: RegExp; key: string }[] = [
  { re: /^maior pontua[çc][ãa]o$/i, key: 'maior_pontuacao' },
  { re: /^maior aten[çc][ãa]o$/i, key: 'maior_atencao' },
];

/**
 * Painel de resultado do MAPA: "41,7 / 100" e, logo ao lado, o rótulo da faixa.
 * São os dois números que MAIS pesam no documento — deixá-los fixos faria todo
 * cliente receber a pontuação da empresa de exemplo.
 */
function markScorePanel(html: string, applied: Set<string>): string {
  return html.replace(/<td\b[^>]*>[\s\S]*?<\/td>/gi, (cell) => {
    // "Linha lógica" da célula: aos olhos do leitor, <br/> e </p> quebram o
    // texto do mesmo jeito, e o Word usa um ou outro conforme quem escreveu o
    // documento. Tratar só <p> custava os marcadores de score e faixa em
    // qualquer modelo que usasse quebra de linha.
    const parts = cell.split(/(<\/p>|<br\s*\/?>|<p\b[^>]*>)/i);
    const separador = (x: string) => /^(<\/p>|<br|<p)/i.test(x);

    let temScore = false;
    for (let i = 0; i < parts.length; i++) {
      if (separador(parts[i])) continue;
      if (!/^\d{1,3}([.,]\d+)?\s*\/\s*100$/.test(plainText(parts[i]))) continue;
      parts[i] = '{{score}} / 100';
      temScore = true;
      applied.add('score');
    }
    if (!temScore) return parts.join('');

    // Rótulo da faixa: bloco curto, sem dígitos, na MESMA célula do score.
    for (let i = 0; i < parts.length; i++) {
      if (separador(parts[i])) continue;
      const t = plainText(parts[i]);
      if (!t || t.includes('{{') || /\d/.test(t) || t.length > 40) continue;
      parts[i] = '{{faixa}}';
      applied.add('faixa');
      break;
    }
    return parts.join('');
  });
}

/**
 * Dado da empresa de EXEMPLO que sobrou solto no corpo do modelo. Se isto sair
 * publicado, TODO cliente recebe a pontuação e o CNPJ de outra empresa — falha
 * silenciosa, que ninguém percebe olhando o documento. Usado como trava na
 * ativação do modelo.
 */
export function findExampleLeaks(html: string): string[] {
  const texto = html
    .replace(/\{\{[\s\S]*?\}\}/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
  const achados: string[] = [];
  const scores = texto.match(/\d{1,3}[.,]\d\s*\/\s*100/g);
  if (scores) achados.push(`pontuação fixa (${[...new Set(scores)].slice(0, 3).join(', ')})`);
  const cnpj = texto.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g);
  if (cnpj) achados.push(`CNPJ fixo (${[...new Set(cnpj)][0]})`);
  return achados;
}

export function autoMarkReportHtml(html: string): { html: string; applied: string[] } {
  const applied = new Set<string>();

  // 1) Tabelas inteiras (identificação, dimensões, matriz, plano, assinaturas…).
  let out = html.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, (table) => {
    if (!plainText(table)) return table;
    const header = tableHeader(table);
    const col1 = tableFirstColumn(table);
    const rule = TABLE_RULES.find((r) => r.test(header, col1));
    if (!rule) return table;
    applied.add(rule.key);
    return `<p>{{${rule.key}}}</p>`;
  });

  // 2) Pares "Rótulo: valor" em texto corrido — só o VALOR vira marcador; o
  //    rótulo escrito no modelo é preservado.
  out = out.replace(
    /(<(p|li|h[1-6])\b[^>]*>)([\s\S]*?)(<\/\2>)/gi,
    (full: string, open: string, _tag: string, inner: string, close: string) => {
      const text = plainText(inner);
      const m = /^([A-Za-zÀ-ÿ\s]{3,40}?)\s*[:·]\s*(.+)$/.exec(text);
      if (!m) return full;
      const hit = INLINE_LABELS.find((l) => l.re.test(m[1].trim()));
      if (!hit) return full;
      applied.add(hit.key);
      return `${open}${m[1].trim()}: {{${hit.key}}}${close}`;
    },
  );

  // 3) Linhas "Maior pontuação | <dimensão · valor>" — o valor vem do motor.
  out = out.replace(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi, (row) => {
    const cells = row.match(/<t[dh]\b[^>]*>[\s\S]*?<\/t[dh]>/gi);
    if (!cells || cells.length !== 2) return row;
    const label = plainText(cells[0]);
    const hit = ROW_LABELS.find((l) => l.re.test(label));
    if (!hit) return row;
    applied.add(hit.key);
    return row.replace(cells[1], `<td><p>{{${hit.key}}}</p></td>`);
  });

  // 4) Painel com o score e a faixa do diagnóstico.
  out = markScorePanel(out, applied);

  return { html: out, applied: [...applied] };
}
