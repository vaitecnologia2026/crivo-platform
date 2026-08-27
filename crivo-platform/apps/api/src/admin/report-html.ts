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
  table: [],
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

/** Regra de reconhecimento de uma tabela de exemplo → marcador que a substitui. */
type TableRule = { key: string; test: (text: string) => boolean };

// A ordem importa: a primeira regra que casar vence (matriz antes de plano,
// porque a matriz também cita "Ação recomendada").
const TABLE_RULES: TableRule[] = [
  {
    key: 'matriz_risco',
    test: (t) => /probabilidade/i.test(t) && /severidade/i.test(t),
  },
  {
    key: 'assinaturas',
    test: (t) => /assinatura/i.test(t) && /(respons[áa]vel|nome|cargo)/i.test(t),
  },
  {
    key: 'controle_documental',
    test: (t) => /(hash|identificador)/i.test(t) && /(vers[ãa]o|status)/i.test(t),
  },
  {
    key: 'tabela_dimensoes',
    test: (t) => /dimens[ãa]o/i.test(t) && /([íi]ndice|score|pontua[çc][ãa]o|resultado)/i.test(t),
  },
  {
    key: 'participacao',
    test: (t) => /setor/i.test(t) && /(respondentes|participa[çc][ãa]o|ades[ãa]o)/i.test(t),
  },
  {
    key: 'plano_acao',
    test: (t) => /a[çc][ãa]o/i.test(t) && /(respons[áa]vel|prazo|status)/i.test(t),
  },
  {
    key: 'identificacao',
    test: (t) =>
      /(empresa|organiza[çc][ãa]o|raz[ãa]o social)/i.test(t) &&
      /(cnpj|data de emiss[ãa]o|m[ée]todo aplicado|estabelecimento|per[íi]odo)/i.test(t),
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

/**
 * Troca os blocos de exemplo do arquivo importado pelos marcadores
 * correspondentes. Roda sobre HTML JÁ SANITIZADO.
 */
export function autoMarkReportHtml(html: string): { html: string; applied: string[] } {
  const applied = new Set<string>();

  // 1) Tabelas inteiras (identificação, dimensões, matriz, plano, assinaturas…).
  let out = html.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, (table) => {
    const text = plainText(table);
    if (!text) return table;
    const rule = TABLE_RULES.find((r) => r.test(text));
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

  return { html: out, applied: [...applied] };
}
