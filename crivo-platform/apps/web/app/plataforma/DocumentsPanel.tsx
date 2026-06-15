"use client";

import { useEffect, useState } from "react";
import type { DocumentDescriptor, GeneratedDocument } from "@crivo/types";
import { generateDocument, listDocuments } from "@/lib/api";

/** Documentos gerados conforme produto/saída técnica (Briefing §15). */
export function DocumentsPanel() {
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
            <span className="lib-ic">▤</span>
            <div>
              <strong>{d.title}</strong>
              <span>{d.available ? "Pronto para gerar" : d.reason ?? "Indisponível"}</span>
            </div>
            <button
              className="btn btn--outline-dark btn--sm"
              disabled={!d.available || busy === d.type}
              onClick={() => open(d.type)}
            >
              {busy === d.type ? "Gerando…" : "Gerar / Baixar PDF"}
            </button>
          </li>
        ))}
        {docs.length === 0 && <li className="card__sub">Nenhum documento disponível no momento.</li>}
      </ul>
    </div>
  );
}

/** Abre o documento em uma janela imprimível (Salvar como PDF pelo navegador). */
export function printDocument(doc: GeneratedDocument) {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const meta = doc.meta.map((m) => `<tr><th>${esc(m.label)}</th><td>${esc(m.value)}</td></tr>`).join("");

  const sections = doc.sections
    .map((s) => {
      let inner = "";
      if (s.body) inner += `<p>${esc(s.body)}</p>`;
      if (s.rows) inner += `<table class="kv">${s.rows.map((r) => `<tr><th>${esc(r.label)}</th><td>${esc(r.value)}</td></tr>`).join("")}</table>`;
      if (s.table) {
        const head = s.table.columns.map((c) => `<th>${esc(c)}</th>`).join("");
        const rows = s.table.data
          .map((row) => `<tr>${row.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
          .join("");
        inner += `<table class="grid"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
      }
      return `<section><h2>${esc(s.heading)}</h2>${inner}</section>`;
    })
    .join("");

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(doc.title)} — ${esc(doc.company)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #14202e; max-width: 760px; margin: 40px auto; padding: 0 24px; line-height: 1.5; }
  .brand { font-size: 12px; letter-spacing: .18em; text-transform: uppercase; color: #a8693d; }
  h1 { font-size: 26px; margin: 6px 0 2px; }
  .sub { color: #5a6b7b; font-size: 13px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0 18px; font-size: 13px; }
  table.kv th, table.kv td { text-align: left; padding: 5px 8px; border-bottom: 1px solid #e7e2da; }
  table.kv th { width: 180px; color: #5a6b7b; font-weight: 600; }
  table.grid th, table.grid td { border: 1px solid #e0dacf; padding: 7px 9px; text-align: left; vertical-align: top; }
  table.grid th { background: #f3f0ea; font-size: 12px; }
  h2 { font-size: 15px; border-bottom: 2px solid #0d1f3c; padding-bottom: 4px; margin-top: 24px; }
  .note { margin-top: 30px; padding: 14px 16px; background: #f6f4f0; border-left: 3px solid #a8693d; font-size: 11.5px; color: #3a4858; font-style: italic; }
  .foot { margin-top: 16px; font-size: 11px; color: #8a97a5; }
  @media print { body { margin: 0; } button { display: none; } }
</style></head><body>
  <div class="brand">CRIVO™ · ${esc(doc.subtitle ?? "Documento de apoio")}</div>
  <h1>${esc(doc.title)}</h1>
  <div class="sub">${esc(doc.company)} · gerado em ${new Date(doc.generatedAt).toLocaleString("pt-BR")}</div>
  <table class="kv">${meta}</table>
  ${sections}
  <div class="note">${esc(doc.responsibilityNote)}</div>
  <div class="foot">CRIVO™ — Decision Intelligence · documento de apoio técnico, gerencial e documental.</div>
  <button onclick="window.print()" style="margin-top:24px;padding:10px 18px;background:#a8693d;color:#fff;border:0;border-radius:4px;cursor:pointer;font-family:sans-serif">Imprimir / Salvar PDF</button>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) { alert("Permita pop-ups para gerar o documento."); return; }
  w.document.write(html);
  w.document.close();
}
