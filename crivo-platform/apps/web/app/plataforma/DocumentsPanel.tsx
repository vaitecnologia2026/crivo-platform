"use client";

import { useEffect, useState } from "react";
import type { DocumentDescriptor, GeneratedDocument } from "@crivo/types";
import { emitReportDocument, generateDocument, listDocuments } from "@/lib/api";
import { IconGrid } from "./Icons";

/**
 * Documentos gerados conforme produto/saída técnica (Briefing §15).
 * Pré-visualizar = geração dinâmica (sempre reflete o estado atual).
 * Emitir versão oficial = Motor 4 (R-001): congela o conteúdo com numeração
 * sequencial e hash — a versão emitida nunca muda depois.
 */
export function DocumentsPanel({ onEmitted }: { onEmitted?: () => void } = {}) {
  const [docs, setDocs] = useState<DocumentDescriptor[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listDocuments().then((d) => { if (alive) setDocs(d); }).catch(() => { if (alive) setDocs([]); });
    return () => { alive = false; };
  }, []);

  async function open(type: string) {
    setBusy(type);
    try {
      const doc = await generateDocument(type);
      printDocument(doc);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao gerar documento");
    } finally {
      setBusy(null);
    }
  }

  async function emit(type: string) {
    setBusy(type);
    try {
      const { emission, reused } = await emitReportDocument(type);
      if (reused) {
        alert(`O conteúdo não mudou desde a emissão v${emission.emissionNumber} — nenhuma versão nova foi criada.`);
      }
      printDocument(emission.content);
      onEmitted?.();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao emitir o documento");
    } finally {
      setBusy(null);
    }
  }

  if (!docs) return null;

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="card__head">
        <div>
          <h3>Documentos</h3>
          <span className="card__sub">Proporcionais ao produto e à saída técnica do contrato.</span>
        </div>
      </div>
      <ul className="lib-list">
        {docs.map((d) => (
          <li key={d.type} className="lib-row">
            <span className="lib-ic"><IconGrid size={14} /></span>
            <div>
              <strong>{d.title}</strong>
              {d.subtitle && (
                <span style={{ display: "block", color: "var(--terra)", fontWeight: 600, fontSize: 12, margin: "2px 0" }}>
                  Diagnóstico: {d.subtitle}
                </span>
              )}
              <span>{d.available ? "Pronto para gerar" : d.reason ?? "Indisponível"}</span>
            </div>
            <span style={{ display: "inline-flex", gap: 8 }}>
              <button
                className="btn btn--outline-dark btn--sm"
                disabled={!d.available || busy === d.type}
                onClick={() => open(d.type)}
              >
                {busy === d.type ? "Gerando…" : "Pré-visualizar"}
              </button>
              <button
                className="btn btn--gold btn--sm"
                disabled={!d.available || busy === d.type}
                onClick={() => emit(d.type)}
                title="Congela esta versão no repositório oficial (numerada e com hash de integridade)."
              >
                Emitir versão oficial
              </button>
            </span>
          </li>
        ))}
        {docs.length === 0 && <li className="card__sub">Nenhum documento disponível no momento.</li>}
      </ul>
    </div>
  );
}

/** Monta o HTML completo do documento — usado pelo print E pela pré-visualização
 *  dos Modelos de relatório no super admin (iframe), para o preview ser fiel. */
export function renderDocumentHtml(doc: GeneratedDocument): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Cabeçalho oficial (modelo do Dossiê Técnico): identificação em GRADE DE PARES,
  // duas por linha. Campos sem valor NÃO são exibidos — o modelo oficial proíbe
  // campo vazio/"—" no documento.
  const metaItems = doc.meta.filter((m) => {
    const v = (m.value ?? "").trim();
    return v !== "" && v !== "—" && v !== "-";
  });
  const metaRows: string[] = [];
  for (let i = 0; i < metaItems.length; i += 2) {
    const a = metaItems[i];
    const b = metaItems[i + 1];
    metaRows.push(
      `<tr><th>${esc(a.label)}</th><td>${esc(a.value)}</td>` +
        (b ? `<th>${esc(b.label)}</th><td>${esc(b.value)}</td>` : `<th></th><td></td>`) +
        `</tr>`,
    );
  }
  const meta = metaRows.join("");

  const sections = doc.sections
    .map((s) => {
      let inner = "";
      // Corpos com quebras de linha (textos aprovados F3, complementos) saem
      // como parágrafos reais — sem isto o HTML colapsa tudo em um bloco só.
      if (s.body) {
        inner += s.body
          .split(/\n{2,}/)
          .map((p) => `<p>${esc(p).replace(/\n/g, "<br/>")}</p>`)
          .join("");
      }
      if (s.rows) inner += `<table class="kv">${s.rows.map((r) => `<tr><th>${esc(r.label)}</th><td>${esc(r.value)}</td></tr>`).join("")}</table>`;
      if (s.table) {
        const head = s.table.columns.map((c) => `<th>${esc(c)}</th>`).join("");
        const rows = s.table.data
          .map((row) => `<tr>${row.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
          .join("");
        inner += `<table class="grid"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
      }
      // Modelo FIEL ao arquivo importado: o corpo chega como HTML JA SANEADO no
      // servidor (allowlist de tags/atributos em report-html.ts) e entra como
      // esta, para preservar tabelas, listas e formatacao do documento original.
      if (s.html) inner += s.html;
      // Sem titulo quando o proprio corpo do modelo ja traz a titulacao dele.
      const title = s.heading ? `<h2>${esc(s.heading)}</h2>` : "";
      return `<section>${title}${inner}</section>`;
    })
    .join("");

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(doc.title)} — ${esc(doc.company)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #14202e; max-width: 760px; margin: 40px auto; padding: 0 24px; line-height: 1.5; }
  .brandbar { display: flex; align-items: center; gap: 10px; padding-bottom: 14px; }
  .brandbar svg { width: 34px; height: 32px; flex: 0 0 auto; }
  .brandbar b { font-family: Georgia, serif; font-size: 19px; letter-spacing: .16em; color: #0d1f3c; display: block; line-height: 1; }
  .brandbar small { font-size: 7px; letter-spacing: .24em; text-transform: uppercase; color: #8a97a5; display: block; margin-top: 3px; }
  .rule { border: 0; border-top: 2px solid #0d1f3c; margin: 0 0 22px; }
  h1 { font-size: 27px; margin: 0 0 4px; color: #0d1f3c; font-weight: 600; line-height: 1.22; }
  .sub { color: #5a6b7b; font-size: 13px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0 18px; font-size: 13px; }
  /* Identificação em pares (Organização | CNPJ · Estabelecimento | Método…) */
  table.ident { margin-top: 18px; }
  table.ident th, table.ident td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e7e2da; vertical-align: top; }
  table.ident th { background: #f3f0ea; color: #0d1f3c; font-weight: 700; font-size: 12px; width: 19%; }
  table.ident td { width: 31%; color: #14202e; }
  table.kv th, table.kv td { text-align: left; padding: 5px 8px; border-bottom: 1px solid #e7e2da; }
  table.kv th { width: 180px; color: #5a6b7b; font-weight: 600; }
  table.grid th, table.grid td { border: 1px solid #e0dacf; padding: 7px 9px; text-align: left; vertical-align: top; }
  table.grid th { background: #f3f0ea; font-size: 12px; }
  h2 { font-size: 15px; border-bottom: 2px solid #0d1f3c; padding-bottom: 4px; margin-top: 24px; }
  h3 { font-size: 13.5px; color: #0d1f3c; margin: 18px 0 6px; }
  h4, h5, h6 { font-size: 12.5px; color: #0d1f3c; margin: 14px 0 5px; }
  /* Conteudo vindo do modelo importado do Word (tabelas, listas, imagens). */
  section ul, section ol { margin: 8px 0 14px; padding-left: 22px; }
  section li { margin-bottom: 4px; }
  section img { max-width: 100%; height: auto; }
  section a { color: #a8693d; }
  /* Tabela do modelo: SO leva grade quando ela tem borda no Word (classe
     mdl-grid). O Word usa tabela sem borda para posicionar logo e titulo —
     desenhar linhas ali faria o documento sair diferente do arquivo. */
  section table.mdl-grid th,
  section table.mdl-grid td { border: 1px solid #e0dacf; padding: 7px 9px; text-align: left; vertical-align: top; }
  section table.mdl-grid th { background: #f3f0ea; font-size: 12px; }
  /* Traco fino embaixo de cada linha — o estilo dos modelos oficiais CRIVO. */
  section table.mdl-rows th,
  section table.mdl-rows td { border: 0; border-bottom: 1px solid #e7e2da; padding: 6px 10px 6px 0; text-align: left; vertical-align: top; }
  section table.mdl-rows th { font-weight: 700; color: #0d1f3c; }
  /* Tabela de LAYOUT (logo + titulo do cabecalho): sem nenhuma linha. */
  section table:not(.kv):not(.grid):not(.ident):not(.mdl-grid):not(.mdl-rows) th,
  section table:not(.kv):not(.grid):not(.ident):not(.mdl-grid):not(.mdl-rows) td { border: 0; padding: 4px 10px 4px 0; text-align: left; vertical-align: top; }
  .note { margin-top: 30px; padding: 14px 16px; background: #f6f4f0; border-left: 3px solid #a8693d; font-size: 11.5px; color: #3a4858; font-style: italic; }
  .foot { margin-top: 16px; font-size: 11px; color: #8a97a5; }
  /* Margem zero na PAGINA tira o cabecalho/rodape que o navegador imprime
     por conta propria (data, titulo, URL blob: e numero de pagina). O
     respiro volta como padding do proprio documento, no padrao CRIVO. */
  @page { size: A4; margin: 0; }
  @media print {
    body { margin: 0; max-width: none; padding: 18mm 16mm; }
    button { display: none; }
    section { break-inside: avoid; }
    table { break-inside: auto; }
    tr { break-inside: avoid; }
  }
</style></head><body>
  <div class="brandbar">
    <svg viewBox="0 0 48 44" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <line x1="5" y1="37" x2="24" y2="6" stroke="#0d1f3c" stroke-width="2.2" stroke-linecap="round"/>
      <line x1="43" y1="37" x2="24" y2="6" stroke="#0d1f3c" stroke-width="2.2" stroke-linecap="round"/>
      <line x1="5" y1="37" x2="17" y2="37" stroke="#0d1f3c" stroke-width="2.2" stroke-linecap="round"/>
      <line x1="31" y1="37" x2="43" y2="37" stroke="#0d1f3c" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="24" cy="6" r="3.4" fill="#a8693d"/>
    </svg>
    <span><b>CRIVO</b><small>Decision Intelligence</small></span>
  </div>
  <hr class="rule"/>
  <h1>${esc(doc.title)}</h1>
  <div class="sub">${esc(doc.subtitle ?? "Documento de apoio")}</div>
  <table class="ident">${meta}</table>
  ${sections}
  <div class="note">${esc(doc.responsibilityNote)}</div>
  <div class="foot">CRIVO™ — Decision Intelligence · documento de apoio técnico, gerencial e documental.</div>
  <button onclick="window.print()" style="margin-top:24px;padding:10px 18px;background:#a8693d;color:#fff;border:0;border-radius:4px;cursor:pointer;font-family:sans-serif">Imprimir / Salvar PDF</button>
</body></html>`;

  return html;
}

/** Abre o documento em uma janela imprimível (Salvar como PDF pelo navegador). */
export function printDocument(doc: GeneratedDocument) {
  const html = renderDocumentHtml(doc);

  // O documento precisa SEMPRE sair. Bloqueio de pop-up é o padrão de muitos
  // navegadores: quando window.open volta null, em vez de só avisar, baixamos o
  // arquivo — o operador fica com o documento em mãos de qualquer jeito.
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const nome = `${doc.title} — ${doc.company}`.replace(/[^\p{L}\p{N} .·—-]/gu, "").slice(0, 120) + ".html";

  const w = window.open(url, "_blank");
  if (!w) {
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  // Revoga depois da janela/download consumir o blob.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
