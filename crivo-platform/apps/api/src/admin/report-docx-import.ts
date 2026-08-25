import { BadRequestException } from '@nestjs/common';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

/**
 * Importação de um modelo de relatório a partir de um .docx (Word) ou .pdf.
 * Extrai o texto em SEÇÕES editáveis {heading, body} para o admin revisar e
 * salvar como ReportTemplate. O binário nunca é persistido — só o texto.
 *
 * O documento do cliente pode vir sem estilos de heading (só texto corrido); por
 * isso usamos `convertToHtml` no Word (preserva h1–h6/p/li/table quando existem)
 * e, como fallback — único caminho no PDF, que não tem marcação —, uma
 * heurística de "linha curta = título".
 */

export type ReportImportSection = { heading: string; body: string };
export type ReportImportResult = { name: string; sections: ReportImportSection[]; warnings: string[] };

// Espelham os limites de cleanSections() no reports.service.ts.
const MAX_SECTIONS = 20;
const MAX_HEADING = 160;
const MAX_BODY = 8000;

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
    .replace(/<[^>]+>/g, '')
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
      const result = await mammoth.convertToHtml({ buffer: buf });
      html = result.value ?? '';
    } catch {
      throw new BadRequestException('Não foi possível ler o documento. Confirme que é um .docx válido.');
    }
    blocks = htmlToBlocks(html);
  }

  if (blocks.length === 0) {
    throw new BadRequestException('O documento não tem texto que possa ser importado.');
  }
  const { sections, warnings } = clampSections(blocksToSections(blocks));
  if (sections.length === 0) {
    throw new BadRequestException('Não foi possível identificar seções no documento.');
  }
  return { name: nameFromFilename(filename), sections, warnings };
}
