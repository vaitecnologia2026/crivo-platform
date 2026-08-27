import { BadRequestException } from '@nestjs/common';
import { REPORT_PLACEHOLDERS } from '@crivo/types';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

import { autoMarkReportHtml, sanitizeReportHtml } from './report-html';

/**
 * Importação de um modelo de relatório a partir de um .docx (Word) ou .pdf.
 *
 * Produz DUAS leituras do mesmo arquivo:
 *  1. `html` — o corpo FIEL do documento (títulos, tabelas, listas, negrito e
 *     imagens), sanitizado e com os blocos de exemplo já trocados por
 *     marcadores `{{chave}}`. É o que faz o relatório emitido sair igual ao
 *     modelo, com os dados reais na POSIÇÃO em que o cliente os desenhou.
 *     Só existe para .docx — em PDF a estrutura não é recuperável.
 *  2. `sections` — o mesmo conteúdo achatado em {heading, body} editável, que
 *     continua sendo o caminho dos modelos escritos à mão.
 *
 * O binário nunca é persistido. O documento do cliente pode vir sem estilos de
 * heading (só texto corrido); por isso a extração em seções tem, como fallback
 * — único caminho no PDF, que não tem marcação —, a heurística "linha curta =
 * título".
 */

export type ReportImportSection = { heading: string; body: string };

/** Padrões oficiais de relatório reconhecidos na importação. Cada um tem um
 *  esqueleto próprio (ordem das seções + o que é dinâmico). */
export type ReportPattern = 'MAPA_EXECUTIVO' | 'DOSSIE_TECNICO' | 'GENERICO';

export type ReportImportResult = {
  name: string;
  pattern: ReportPattern;
  patternLabel: string;
  /** Flags de injeção automática sugeridas pelo padrão detectado. */
  suggested: { includeResults: boolean; includeDimensions: boolean; includePlan: boolean };
  sections: ReportImportSection[];
  /** Corpo fiel do .docx (sanitizado e marcado). `null` em PDF. */
  html: string | null;
  /** Marcadores que a detecção automática aplicou no HTML. */
  placeholders: string[];
  warnings: string[];
};

/** Um "slot" do esqueleto oficial. `dynamic` = o conteúdo vem do motor (score,
 *  dimensões, plano); o texto de exemplo do arquivo é DESCARTADO e viramos a
 *  flag correspondente, para o relatório sair com os números reais da empresa. */
type PatternSlot = {
  heading: string;
  match: RegExp;
  dynamic?: 'results' | 'dimensions' | 'plan';
};

type PatternSpec = { label: string; slots: PatternSlot[] };

const PATTERNS: Record<Exclude<ReportPattern, 'GENERICO'>, PatternSpec> = {
  // Modelo "MAPA Executivo · Visão preliminar da organização" (2 páginas).
  MAPA_EXECUTIVO: {
    label: 'MAPA Executivo',
    slots: [
      { heading: 'Visão preliminar da organização', match: /vis[ãa]o preliminar|introdu[çc][ãa]o|objetivo/i },
      { heading: 'Panorama', match: /panorama/i, dynamic: 'results' },
      { heading: 'Dimensões', match: /dimens[õo]es/i, dynamic: 'dimensions' },
      { heading: 'Síntese executiva', match: /s[íi]ntese executiva/i },
      { heading: 'Caminho recomendado', match: /caminho recomendado/i },
      { heading: 'Limites de uso', match: /n[ãa]o substitui|preliminar de gest[ãa]o|limites/i },
    ],
  },
  // Modelo "Dossiê Técnico de Fatores de Riscos Psicossociais" (5 páginas).
  DOSSIE_TECNICO: {
    label: 'Dossiê Técnico NR-1',
    slots: [
      { heading: 'Objetivo e escopo', match: /objetivo e escopo|objetivo/i },
      { heading: 'Responsabilidades', match: /responsabilidades/i },
      { heading: 'Escopo da avaliação', match: /escopo da avalia[çc][ãa]o|confidencialidade/i },
      { heading: 'Metodologia e critérios', match: /metodologia|crit[ée]rios|matriz de risco|m[ée]todo de avalia[çc][ãa]o/i },
      { heading: 'Síntese do ciclo', match: /s[íi]ntese do ciclo|s[íi]ntese executiva|resultados por dimens[ãa]o/i, dynamic: 'dimensions' },
      { heading: 'Prioridades técnicas', match: /prioridades t[ée]cnicas/i, dynamic: 'results' },
      { heading: 'Inventário técnico', match: /invent[áa]rio t[ée]cnico|caracteriza[çc][ãa]o dos fatores|exposi[çc][ãa]o, poss[íi]veis agravos/i },
      { heading: 'Medidas e plano de ação', match: /medidas e plano|plano de a[çc][ãa]o/i, dynamic: 'plan' },
      { heading: 'Participação, comunicação e evidências', match: /participa[çc][ãa]o|comunica[çc][ãa]o|evid[êe]ncias/i },
      { heading: 'Controle documental e responsabilidade', match: /controle documental|responsabilidade legal/i },
    ],
  },
};

/** Blocos que são IDENTIFICAÇÃO ou dados de exemplo — não viram texto fixo do
 *  modelo (empresa, respondente, CNPJ e afins vêm do contrato/motor). */
const IDENTITY_RE =
  /^(empresa|organiza[çc][ãa]o|respondente|data|cnpj|estabelecimento|per[íi]odo avaliado|data de emiss[ãa]o|vers[ãa]o metodol[óo]gica|ciclo|m[ée]todo aplicado)\b/i;

function detectPattern(text: string): ReportPattern {
  const t = text.toLowerCase();
  if (/dossi[êe]\s+t[ée]cnico|invent[áa]rio t[ée]cnico|riscos psicossociais relacionados ao trabalho/.test(t)) {
    return 'DOSSIE_TECNICO';
  }
  if (/mapa executivo/.test(t) || (/panorama/.test(t) && /caminho recomendado/.test(t))) {
    return 'MAPA_EXECUTIVO';
  }
  return 'GENERICO';
}

// Espelham os limites de cleanSections() no reports.service.ts.
const MAX_SECTIONS = 20;
const MAX_HEADING = 160;
const MAX_BODY = 8000;
/** Teto do corpo fiel guardado no modelo (o banco aguenta, o payload do editor não). */
const MAX_TEMPLATE_HTML = 1_500_000;
/** Imagem maior que isto (base64) fica de fora — uma logo cabe folgado. */
const MAX_IMAGE_BASE64 = 700_000;

function extOf(filename: string): string {
  const i = filename.lastIndexOf('.');
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : '';
}

/** Nome sugerido a partir do arquivo (sem extensão, _ e - viram espaço). */
function nameFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  return base.slice(0, 120) || 'Modelo importado';
}

function decodeEntities(s: string): string {
  return s
    // Tag vira ESPAÇO (não string vazia): células com mais de um parágrafo
    // colavam os textos ("EMPRESA" + "O2 Legacy" => "EMPRESAO2 Legacy").
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(Number(d)))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Texto de uma <table> vira linhas "célula · célula · célula". */
function tableToText(tableHtml: string): string {
  const rows = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  return rows
    .map((tr) => {
      const cells = tr.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) ?? [];
      return cells.map((c) => decodeEntities(c)).filter(Boolean).join(' · ');
    })
    .filter(Boolean)
    .join('\n');
}

type Block = { kind: 'heading' | 'text'; text: string };

/** Quebra o HTML do mammoth numa lista linear de blocos (título vs texto). */
function htmlToBlocks(html: string): Block[] {
  const blocks: Block[] = [];
  // Captura h1–h6, p, li e table na ordem em que aparecem.
  const re = /<(h[1-6]|p|li|table)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const tag = m[1].toLowerCase();
    if (tag === 'table') {
      const t = tableToText(m[2]);
      if (t) blocks.push({ kind: 'text', text: t });
      continue;
    }
    const text = decodeEntities(m[2]);
    if (!text) continue;
    if (/^h[1-6]$/.test(tag)) blocks.push({ kind: 'heading', text });
    else if (tag === 'li') blocks.push({ kind: 'text', text: `• ${text}` });
    else blocks.push({ kind: 'text', text });
  }
  return blocks;
}

/** Heurística: um parágrafo curto, sem pontuação final, seguido de conteúdo, é
 *  um título. Usada quando o .docx não traz estilos de heading. */
function looksLikeHeading(text: string): boolean {
  if (text.length === 0 || text.length > 80) return false;
  if (/[.!?;:,]$/.test(text)) return false;
  if (text.startsWith('•')) return false;
  const words = text.split(/\s+/);
  return words.length <= 10;
}

function pushSection(sections: ReportImportSection[], heading: string, bodyParts: string[]) {
  const body = bodyParts.join('\n\n').trim();
  const h = heading.trim();
  if (!h && !body) return;
  sections.push({ heading: h.slice(0, MAX_HEADING), body });
}

/** Converte a lista de blocos em seções {heading, body}. */
function blocksToSections(blocks: Block[]): ReportImportSection[] {
  const hasRealHeadings = blocks.some((b) => b.kind === 'heading');
  const sections: ReportImportSection[] = [];
  let curHeading = '';
  let curBody: string[] = [];

  const flush = () => {
    pushSection(sections, curHeading, curBody);
    curHeading = '';
    curBody = [];
  };

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    // Sem estilos de heading no .docx, uma linha curta só é título quando o
    // PRÓXIMO bloco é conteúdo (corpo/tabela) — assim "Dimensões", "Síntese
    // executiva" viram títulos, mas pares rótulo/valor curtos (EMPRESA / O2…)
    // não explodem em dezenas de seções.
    const next = blocks[i + 1];
    const nextIsBody = !!next && !(next.kind === 'heading' || (!hasRealHeadings && looksLikeHeading(next.text)));
    const isHeading =
      b.kind === 'heading' || (!hasRealHeadings && looksLikeHeading(b.text) && nextIsBody);
    if (isHeading) {
      // Novo título fecha a seção anterior (se tiver conteúdo).
      if (curHeading || curBody.length) flush();
      curHeading = b.text;
    } else {
      curBody.push(b.text);
    }
  }
  flush();

  // Se a 1ª seção nasceu só com corpo (doc começou sem título), dá um heading.
  if (sections.length && !sections[0].heading) sections[0].heading = 'Introdução';
  return sections;
}

/**
 * Encaixa as seções extraídas do arquivo no ESQUELETO do padrão detectado:
 * mantém a ordem oficial, normaliza os títulos e separa o que é conteúdo fixo
 * (vai para o modelo) do que é dinâmico (vira flag; o motor preenche com os
 * dados reais da empresa). O que não casar com nenhum slot é preservado no fim.
 */
function fitToPattern(
  sections: ReportImportSection[],
  pattern: ReportPattern,
): {
  sections: ReportImportSection[];
  suggested: { includeResults: boolean; includeDimensions: boolean; includePlan: boolean };
  warnings: string[];
} {
  const suggested = { includeResults: false, includeDimensions: false, includePlan: false };
  const warnings: string[] = [];
  if (pattern === 'GENERICO') return { sections, suggested, warnings };

  const spec = PATTERNS[pattern];
  const filled = new Map<number, string[]>(); // slot index -> corpos
  const extras: ReportImportSection[] = [];
  const dynamicSeen = new Set<string>();

  for (const s of sections) {
    const label = `${s.heading} ${s.body}`.trim();
    // Identificação (empresa/CNPJ/respondente/data) não vira texto fixo.
    if (IDENTITY_RE.test(s.heading.trim()) || (!s.heading && IDENTITY_RE.test(s.body.trim()))) {
      continue;
    }
    const idx = spec.slots.findIndex((slot) => slot.match.test(s.heading) || (!s.heading && slot.match.test(label)));
    if (idx === -1) {
      if (s.heading || s.body) extras.push(s);
      continue;
    }
    const slot = spec.slots[idx];
    if (slot.dynamic) {
      // Conteúdo de exemplo (scores, faixas, tabela de dimensões) é descartado:
      // o motor injeta os números reais pela flag correspondente.
      if (slot.dynamic === 'results') suggested.includeResults = true;
      if (slot.dynamic === 'dimensions') suggested.includeDimensions = true;
      if (slot.dynamic === 'plan') suggested.includePlan = true;
      dynamicSeen.add(slot.heading);
      continue;
    }
    const list = filled.get(idx) ?? [];
    list.push(s.body || s.heading);
    filled.set(idx, list);
  }

  const out: ReportImportSection[] = [];
  spec.slots.forEach((slot, i) => {
    if (slot.dynamic) return;
    const bodies = filled.get(i);
    if (!bodies || !bodies.join('').trim()) return;
    out.push({ heading: slot.heading, body: bodies.join('\n\n').trim() });
  });
  out.push(...extras);

  warnings.push(`Padrão reconhecido: ${spec.label}. As seções foram organizadas na ordem do modelo oficial.`);
  if (dynamicSeen.size) {
    warnings.push(
      `${[...dynamicSeen].join(', ')} não vira texto fixo — o motor preenche com os dados reais da empresa (já marquei as opções de injeção automática).`,
    );
  }
  return { sections: out, suggested, warnings };
}

/** Aplica os limites do ReportTemplate (máx. seções e tamanho do corpo). */
function clampSections(sections: ReportImportSection[]): { sections: ReportImportSection[]; warnings: string[] } {
  const warnings: string[] = [];
  let out = sections.filter((s) => s.heading || s.body);

  out = out.map((s) => {
    if (s.body.length > MAX_BODY) {
      warnings.push(`A seção "${s.heading || 'sem título'}" foi cortada em ${MAX_BODY} caracteres.`);
      return { ...s, body: s.body.slice(0, MAX_BODY) };
    }
    return s;
  });

  if (out.length > MAX_SECTIONS) {
    const keep = out.slice(0, MAX_SECTIONS - 1);
    const rest = out.slice(MAX_SECTIONS - 1);
    const merged = rest.map((s) => (s.heading ? `${s.heading}\n${s.body}` : s.body)).join('\n\n');
    keep.push({ heading: rest[0].heading || 'Demais seções', body: merged.slice(0, MAX_BODY) });
    warnings.push(`O documento tinha ${out.length} seções; as excedentes foram unidas na última (máx. ${MAX_SECTIONS}).`);
    out = keep;
  }
  return { sections: out, warnings };
}

/** Texto puro do PDF vira blocos: linhas curtas ficam isoladas (candidatas a
 *  título pela heurística) e linhas seguidas se juntam num parágrafo. */
function pdfTextToBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (!para.length) return;
    const joined = para.join(' ').replace(/\s+/g, ' ').trim();
    if (joined) blocks.push({ kind: 'text', text: joined });
    para = [];
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (looksLikeHeading(line)) {
      flush();
      blocks.push({ kind: 'text', text: line });
      continue;
    }
    para.push(line);
  }
  flush();
  return blocks;
}

/**
 * Extrai seções de um .docx ou .pdf. Aceita `.doc` apenas quando o conteúdo é,
 * na verdade, um OOXML (assinatura "PK") renomeado — caso comum de "Salvar como".
 */
export async function extractReportSections(filename: string, buf: Buffer): Promise<ReportImportResult> {
  const ext = extOf(filename);
  let blocks: Block[];
  let rawHtml = '';

  if (ext === 'pdf') {
    const isPdf = buf.length >= 4 && buf.toString('latin1', 0, 4) === '%PDF';
    if (!isPdf) throw new BadRequestException('O arquivo não parece ser um PDF válido.');
    // pdf-parse v2: API de classe; destroy() libera o documento mesmo em falha.
    const parser = new PDFParse({ data: buf });
    let text: string;
    try {
      const result = await parser.getText();
      text = result.text ?? '';
    } catch {
      throw new BadRequestException('Não foi possível ler o PDF. Confirme que não está protegido por senha.');
    } finally {
      await parser.destroy().catch(() => undefined);
    }
    blocks = pdfTextToBlocks(text.slice(0, 200_000));
  } else {
    const isZip = buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b; // "PK"
    if (ext !== 'docx' && !(ext === 'doc' && isZip)) {
      throw new BadRequestException('Envie um arquivo .docx (Word) ou .pdf. Se for um .doc antigo, salve como .docx e tente de novo.');
    }
    if (!isZip) {
      throw new BadRequestException('Arquivo .doc no formato antigo não é suportado. Salve como .docx e tente de novo.');
    }
    let html: string;
    try {
      const result = await mammoth.convertToHtml(
        { buffer: buf },
        {
          // Sublinhado e tachado não estão no mapa padrão do mammoth, e os
          // modelos oficiais usam os dois em cabeçalho de tabela.
          styleMap: ['u => u', 'strike => s'],
          // Imagens viram data URI: o modelo fica autocontido (nada de arquivo
          // externo para servir depois).
          convertImage: mammoth.images.imgElement(async (image) => {
            const b64 = await image.read('base64');
            if (!b64 || b64.length > MAX_IMAGE_BASE64) return { src: '' };
            return { src: `data:${image.contentType};base64,${b64}` };
          }),
        },
      );
      html = result.value ?? '';
    } catch {
      throw new BadRequestException('Não foi possível ler o documento. Confirme que é um .docx válido.');
    }
    rawHtml = html;
    blocks = htmlToBlocks(html);
  }

  if (blocks.length === 0) {
    throw new BadRequestException('O documento não tem texto que possa ser importado.');
  }

  // 1) Blocos → seções; 2) seções → esqueleto do padrão oficial detectado.
  const pattern = detectPattern(blocks.map((b) => b.text).join('\n'));
  const fitted = fitToPattern(blocksToSections(blocks), pattern);
  const { sections, warnings } = clampSections(fitted.sections);
  if (sections.length === 0) {
    throw new BadRequestException('Não foi possível identificar seções no documento.');
  }
  if (ext === 'pdf') {
    warnings.push(
      'Importado de PDF: o layout do arquivo NÃO é reproduzido (a extração perde tabelas, listas e até caracteres). ' +
        'Para o relatório sair igual ao modelo, importe o .docx.',
    );
  }

  // Corpo fiel: sanear (o arquivo vem de fora) e trocar os blocos de exemplo
  // por marcadores. Sem isso o modelo sairia com os números da outra empresa.
  const fidelity = buildFidelityHtml(rawHtml);
  warnings.push(...fidelity.warnings);

  return {
    name: nameFromFilename(filename),
    pattern,
    patternLabel: pattern === 'GENERICO' ? 'Documento livre' : PATTERNS[pattern].label,
    suggested: fitted.suggested,
    sections,
    html: fidelity.html,
    placeholders: fidelity.placeholders,
    warnings: [...fitted.warnings, ...warnings],
  };
}

/**
 * HTML do arquivo → corpo fiel do modelo: allowlist de tags/atributos e
 * marcação automática dos blocos dinâmicos. Documento grande demais perde
 * primeiro as imagens (e só então é cortado), para preservar o texto.
 */
function buildFidelityHtml(rawHtml: string): { html: string | null; placeholders: string[]; warnings: string[] } {
  const warnings: string[] = [];
  if (!rawHtml.trim()) return { html: null, placeholders: [], warnings };

  let clean = sanitizeReportHtml(rawHtml);
  if (clean.length > MAX_TEMPLATE_HTML) {
    clean = sanitizeReportHtml(rawHtml.replace(/<img\b[^>]*>/gi, ''));
    warnings.push('As imagens do documento eram grandes demais e ficaram de fora do modelo; o texto foi preservado.');
  }
  if (clean.length > MAX_TEMPLATE_HTML) {
    clean = clean.slice(0, MAX_TEMPLATE_HTML);
    warnings.push('O documento excedeu o tamanho máximo do modelo e foi cortado no fim.');
  }
  if (!clean) return { html: null, placeholders: [], warnings };

  const marked = autoMarkReportHtml(clean);
  if (marked.applied.length) {
    const labels = marked.applied
      .map((k) => REPORT_PLACEHOLDERS.find((p) => p.key === k)?.label ?? k)
      .join(', ');
    warnings.push(
      `Blocos de exemplo reconhecidos e trocados por marcadores: ${labels}. ` +
        'Na emissão eles são preenchidos com os dados reais da empresa, na mesma posição do modelo.',
    );
  }
  return { html: marked.html, placeholders: marked.applied, warnings };
}
