import { BadRequestException } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

/**
 * Extração de TEXTO dos anexos de prompt personalizado (IA da Plataforma ·
 * Prompts e Políticas). O binário nunca é persistido — só o texto extraído,
 * que vira "[Material de referência: …]" no prompt de sistema.
 *
 * A validação é por EXTENSÃO do filename (o navegador manda mime vazio para
 * `.md`, por exemplo); o mime é gravado apenas como metadado.
 */
export const PROMPT_FILE_EXTENSIONS = ['pdf', 'txt', 'md', 'csv', 'docx', 'xlsx', 'xls'] as const;

/** Teto de texto extraído POR ARQUIVO — evita linha gigante no Postgres. */
const MAX_EXTRACTED_CHARS = 200_000;

function extOf(filename: string): string {
  const i = filename.lastIndexOf('.');
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : '';
}

function truncate(text: string): string {
  if (text.length <= MAX_EXTRACTED_CHARS) return text;
  return `${text.slice(0, MAX_EXTRACTED_CHARS)}\n[conteúdo truncado]`;
}

export async function extractTextFromFile(
  filename: string,
  _mimeType: string,
  buf: Buffer,
): Promise<string> {
  const ext = extOf(filename);

  if (ext === 'txt' || ext === 'md' || ext === 'csv') {
    return truncate(buf.toString('utf8'));
  }

  if (ext === 'pdf') {
    // pdf-parse v2: API de classe (a v1 era função). O destroy() libera o
    // documento do pdfjs mesmo quando a extração falha no meio.
    const parser = new PDFParse({ data: buf });
    try {
      const result = await parser.getText();
      return truncate(result.text);
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  }

  if (ext === 'docx') {
    const result = await mammoth.extractRawText({ buffer: buf });
    return truncate(result.value);
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const wb = XLSX.read(buf, { type: 'buffer' });
    const parts = wb.SheetNames.map(
      (name) => `## Aba: ${name}\n${XLSX.utils.sheet_to_csv(wb.Sheets[name])}`,
    );
    return truncate(parts.join('\n\n'));
  }

  throw new BadRequestException(
    `Formato não aceito. Envie um arquivo ${PROMPT_FILE_EXTENSIONS.join(', ')}.`,
  );
}
