// Parte PURA da exportação (XLSX/PDF) do portal: monta abas, cabeçalhos e
// nomes de arquivo sem tocar em DOM nem nas libs (SheetJS/jsPDF). Separada de
// `exports.ts` para ser testável no vitest sem navegador — e para que as libs
// pesadas continuem carregadas só sob demanda (import() dentro das funções).

/** Contexto que identifica o relatório: quem, onde, quando e sob qual contrato.
 *  Só `company` é obrigatório — tudo que a empresa NÃO tem (unidade, ciclo
 *  aberto, solução contratada) é omitido do cabeçalho, nunca inventado. */
export interface ExportContext {
  company: string;
  unit?: string | null;
  cycle?: string | null;
  contract?: string | null;
}

/** Uma aba do XLSX: as linhas viram colunas pelas chaves do objeto. */
export interface ExportSheet {
  name: string;
  rows: Record<string, unknown>[];
}

/** Uma seção do PDF: título + tabela (colunas pelas chaves do objeto). */
export interface ExportSection {
  heading: string;
  rows: Record<string, unknown>[];
}

/** Excel limita o nome da aba a 31 caracteres. */
export const MAX_SHEET_NAME = 31;

/** Marcador de aba/seção sem linhas — mantém a aba no arquivo (o usuário vê
 *  que a exportação cobriu aquele bloco) sem fingir dado. */
export const EMPTY_SHEET_MARKER = "(sem dados)";

/** Nome de arquivo seguro: minúsculas, sem acento nem símbolo, hífen entre palavras. */
export function sanitizeFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Carimbo `AAAAMMDD-HHMM` (hora local) para diferenciar exportações do mesmo dia. */
export function fileTimestamp(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/** `<nome-base>-<carimbo>.<ext>` — mesmo padrão para XLSX e PDF. */
export function buildFileName(nomeBase: string, ext: "xlsx" | "pdf", d: Date = new Date()): string {
  return `${sanitizeFileName(nomeBase) || "exportacao"}-${fileTimestamp(d)}.${ext}`;
}

/** Data/hora de geração no formato do usuário (pt-BR). */
export function formatGeneratedAt(d: Date = new Date()): string {
  return d.toLocaleString("pt-BR");
}

/** Linhas da aba "Identificação" (sempre a primeira do XLSX). Cada campo
 *  opcional do contexto só entra quando existe. */
export function buildIdentificationRows(ctx: ExportContext, geradoEm: Date = new Date()): (string | number)[][] {
  const rows: (string | number)[][] = [["CRIVO · Portal do Cliente"], ["Empresa", ctx.company]];
  if (ctx.unit) rows.push(["Unidade", ctx.unit]);
  if (ctx.cycle) rows.push(["Ciclo", ctx.cycle]);
  if (ctx.contract) rows.push(["Contratação", ctx.contract]);
  rows.push(["Gerado em", formatGeneratedAt(geradoEm)]);
  return rows;
}

/** Linha de contexto do PDF: `empresa · unidade · ciclo · contratação`, só
 *  com o que existe. Nunca fica vazia porque `company` é obrigatório. */
export function buildContextLine(ctx: ExportContext): string {
  return [ctx.company, ctx.unit, ctx.cycle, ctx.contract]
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .join(" · ");
}

/** Aba pronta para o SheetJS: nome truncado a 31 chars (limite do Excel) e
 *  nomes repetidos após o corte recebem sufixo numérico — o Excel recusa
 *  abas homônimas e o SheetJS lançaria erro na segunda. */
export interface PreparedSheet {
  name: string;
  /** `aoa` = matriz (aba vazia ou Identificação); `json` = objetos por linha. */
  kind: "aoa" | "json";
  aoa?: (string | number)[][];
  json?: Record<string, unknown>[];
}

export function prepareSheets(ctx: ExportContext, sheets: ExportSheet[], geradoEm: Date = new Date()): PreparedSheet[] {
  const used = new Set<string>();
  const uniqueName = (raw: string): string => {
    const base = (raw.trim() || "Dados").slice(0, MAX_SHEET_NAME);
    let candidate = base;
    let n = 2;
    while (used.has(candidate.toLowerCase())) {
      const suffix = ` (${n++})`;
      candidate = base.slice(0, MAX_SHEET_NAME - suffix.length) + suffix;
    }
    used.add(candidate.toLowerCase());
    return candidate;
  };

  const out: PreparedSheet[] = [
    { name: uniqueName("Identificação"), kind: "aoa", aoa: buildIdentificationRows(ctx, geradoEm) },
  ];
  for (const s of sheets) {
    const name = uniqueName(s.name);
    if (!s.rows.length) out.push({ name, kind: "aoa", aoa: [[EMPTY_SHEET_MARKER]] });
    else out.push({ name, kind: "json", json: s.rows });
  }
  return out;
}

/** Tabela de uma seção do PDF: colunas pelas chaves da PRIMEIRA linha (as
 *  demais linhas seguem a mesma ordem; chave ausente vira célula vazia). */
export function buildTable(rows: Record<string, unknown>[]): { columns: string[]; body: string[][] } {
  if (!rows.length) return { columns: [], body: [] };
  const columns = Object.keys(rows[0]);
  const body = rows.map((r) => columns.map((c) => cellText(r[c])));
  return { columns, body };
}

/** Texto de célula: null/undefined viram vazio; datas no formato pt-BR;
 *  booleanos em Sim/Não; o resto pelo String(). */
export function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toLocaleString("pt-BR");
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  return String(v);
}
