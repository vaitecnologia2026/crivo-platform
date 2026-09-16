// Exportação compartilhada do portal (XLSX + PDF), portada do protótipo
// (lovable/Portal do Cliente/src/lib/exports.ts) — sem nada de "protótipo"
// ou "dados demonstrativos": o cabeçalho usa a empresa real (/me/organization)
// e o ciclo/contratação reais quando existem (ver `export-context.ts`).
//
// XLSX: SheetJS (compatível com Excel). PDF: jsPDF + autoTable. As três libs
// são pesadas, então entram por import() DENTRO da função — só quem clica em
// "Exportar" paga o download; o bundle inicial do portal não muda.
//
// Uso típico numa tela:
//   const ctx = useExportContext();
//   <button onClick={() => ctx && exportXLSX("plano-de-acao", [{ name: "Ações", rows }], ctx)} />
import {
  buildContextLine,
  buildFileName,
  buildTable,
  formatGeneratedAt,
  prepareSheets,
  type ExportContext,
  type ExportSection,
  type ExportSheet,
} from "./exports-core";

export type { ExportContext, ExportSection, ExportSheet } from "./exports-core";
export { carregarExportContext, useExportContext } from "./export-context";

// Paleta institucional (mesma do protótipo): Azul Profundo, Areia, Carvão.
const AZUL_PROFUNDO: [number, number, number] = [13, 31, 60];
const AZUL_MEDIO: [number, number, number] = [27, 58, 107];
const AREIA: [number, number, number] = [242, 240, 236];
const AREIA_CLARA: [number, number, number] = [247, 245, 241];
const CARVAO: [number, number, number] = [10, 11, 13];
const CINZA: [number, number, number] = [58, 58, 56];

/** Exporta uma ou mais planilhas em um único .xlsx compatível com Excel.
 *  A aba "Identificação" (empresa, unidade, ciclo, contratação, gerado em) vem
 *  sempre primeiro; aba sem linhas vira "(sem dados)" em vez de sumir. */
export async function exportXLSX(nomeBase: string, abas: ExportSheet[], ctx: ExportContext): Promise<void> {
  const XLSX = await import("xlsx");
  const agora = new Date();
  const wb = XLSX.utils.book_new();

  for (const aba of prepareSheets(ctx, abas, agora)) {
    const ws = aba.kind === "aoa" ? XLSX.utils.aoa_to_sheet(aba.aoa ?? []) : XLSX.utils.json_to_sheet(aba.json ?? []);
    XLSX.utils.book_append_sheet(wb, ws, aba.name);
  }

  XLSX.writeFile(wb, buildFileName(nomeBase, "xlsx", agora));
}

/** Exporta um relatório PDF (A4 paisagem) com faixa institucional, título,
 *  linha de contexto (empresa · unidade · ciclo · contratação — só o que
 *  existe), "Gerado em" e uma tabela por seção. Seção sem linhas é pulada. */
export async function exportPDF(
  nomeBase: string,
  titulo: string,
  secoes: ExportSection[],
  ctx: ExportContext,
): Promise<void> {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const agora = new Date();
  const doc = new JsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Faixa institucional
  doc.setFillColor(...AZUL_PROFUNDO);
  doc.rect(0, 0, pageWidth, 56, "F");
  doc.setTextColor(...AREIA);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("CRIVO · Decision Intelligence", 32, 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Portal do Cliente", 32, 40);

  // Título + contexto
  doc.setTextColor(...CARVAO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(titulo, 32, 88);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...CINZA);
  doc.text(buildContextLine(ctx), 32, 104);
  doc.text(`Gerado em ${formatGeneratedAt(agora)}`, 32, 118);

  let cursorY = 140;
  for (const secao of secoes) {
    const { columns, body } = buildTable(secao.rows);
    if (!columns.length) continue;
    doc.setTextColor(...AZUL_PROFUNDO);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(secao.heading, 32, cursorY);
    cursorY += 8;

    autoTable(doc, {
      startY: cursorY,
      head: [columns],
      body,
      styles: { font: "helvetica", fontSize: 8, cellPadding: 4, textColor: CARVAO },
      headStyles: { fillColor: AZUL_MEDIO, textColor: AREIA },
      alternateRowStyles: { fillColor: AREIA_CLARA },
      margin: { left: 32, right: 32 },
    });
    // O autoTable grava a posição final da última tabela em `doc.lastAutoTable`
    // (não está no tipo do jsPDF, por isso o cast).
    const last = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
    cursorY = (last?.finalY ?? cursorY) + 24;
  }

  doc.save(buildFileName(nomeBase, "pdf", agora));
}
