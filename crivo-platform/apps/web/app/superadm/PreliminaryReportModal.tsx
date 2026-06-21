"use client";

import { useEffect, useState } from "react";
import {
  PRELIMINARY_REPORT_STATUS_LABEL,
  type PlatformLeadSummary,
  type PreliminaryReportData,
  type PreliminaryReportStatus,
} from "@crivo/types";
import {
  generatePreliminaryReport,
  listPreliminaryReportsByLead,
  resendPreliminaryReport,
} from "@/lib/admin-api";

// Renderizador leve de Markdown → HTML (sem dependência): títulos, negrito,
// itálico, listas e tabelas. Suficiente para o formato do Relatório CRIVO.
function mdToHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) =>
    esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
  const out: string[] = [];
  let inList = false;
  let inTable = false;
  const closeList = () => { if (inList) { out.push("</ul>"); inList = false; } };
  const closeTable = () => { if (inTable) { out.push("</tbody></table>"); inTable = false; } };
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (!line) { closeList(); closeTable(); continue; }
    if (/^\|.*\|$/.test(line)) {
      if (/^\|[\s:|-]+\|?$/.test(line)) continue; // linha separadora |---|
      const cells = line.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      if (!inTable) { out.push('<table class="rep-table"><tbody>'); inTable = true; }
      out.push("<tr>" + cells.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>");
      continue;
    }
    closeTable();
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^#{1,6}\s+(.*)$/))) { closeList(); out.push(`<h3>${inline(m[1])}</h3>`); continue; }
    if ((m = line.match(/^\d+\.\s+\*\*(.+?)\*\*\s*$/))) { closeList(); out.push(`<h3>${esc(m[1])}</h3>`); continue; }
    if ((m = line.match(/^[-*]\s+(.*)$/))) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inline(m[1])}</li>`);
      continue;
    }
    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  closeTable();
  return out.join("\n");
}

// Exporta o relatório como PDF abrindo uma janela de impressão limpa
// (o usuário escolhe "Salvar como PDF"). Sem dependência de lib.
function exportReportPdf(markdown: string, subtitle: string) {
  const w = window.open("", "_blank", "width=840,height=920");
  if (!w) return;
  const safeSubtitle = subtitle.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
  <title>Relatório Preliminar CRIVO — ${safeSubtitle}</title><style>
  body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:720px;margin:32px auto;padding:0 28px;color:#1c2540;line-height:1.62}
  .rh{border-bottom:3px solid #a8693d;padding-bottom:12px;margin-bottom:22px}
  .rh h1{color:#0d1f3c;font-size:21px;margin:0 0 3px} .rh .m{color:#727a8c;font-size:13px}
  h3{color:#0d1f3c;font-size:15px;margin:20px 0 7px} p{margin:8px 0} ul{margin:8px 0 8px 20px} li{margin:4px 0}
  strong{color:#0d1f3c} table{width:100%;border-collapse:collapse;margin:10px 0} td{border:1px solid #e6e3dc;padding:6px 11px;font-size:13px}
  .rf{margin-top:26px;border-top:1px solid #e6e3dc;padding-top:10px;color:#9097a8;font-size:11px}
  </style></head><body>
  <div class="rh"><h1>Relatório Preliminar CRIVO</h1><div class="m">${safeSubtitle}</div></div>
  ${mdToHtml(markdown)}
  <div class="rf">Relatório preliminar gerado por IA a partir do Diagnóstico Inicial CRIVO. Não substitui o CRIVO Diagnóstico™ completo nem é avaliação individual ou diagnóstico clínico.</div>
  </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

/**
 * Briefing §5 / Portal §7 — modal de Relatório Preliminar CRIVO.
 * Gera relatório via IA a partir do Diagnóstico Inicial do lead e dispara
 * envio por e-mail (graceful fallback se RESEND_API_KEY não estiver no env).
 */
export function PreliminaryReportModal({
  lead,
  onClose,
}: {
  lead: PlatformLeadSummary;
  onClose: () => void;
}) {
  const [reports, setReports] = useState<PreliminaryReportData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [sendTo, setSendTo] = useState<string>(lead.email ?? "");
  const [resendId, setResendId] = useState<string | null>(null);
  const [resendTo, setResendTo] = useState<string>("");

  async function load() {
    setError(null);
    try {
      setReports(await listPreliminaryReportsByLead(lead.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar relatórios.");
    }
  }

  useEffect(() => {
    let alive = true;
    listPreliminaryReportsByLead(lead.id)
      .then((d) => { if (alive) setReports(d); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Falha ao carregar."); });
    return () => { alive = false; };
  }, [lead.id]);

  async function generate() {
    setError(null);
    setGenerating(true);
    try {
      const r = await generatePreliminaryReport({ platformLeadId: lead.id, sendTo: sendTo || undefined });
      setReports((cur) => [r, ...(cur ?? [])]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao gerar.");
    } finally {
      setGenerating(false);
    }
  }

  async function resend(id: string) {
    if (!resendTo.trim()) return;
    try {
      const updated = await resendPreliminaryReport(id, resendTo.trim());
      setReports((cur) => cur?.map((r) => (r.id === id ? updated : r)) ?? cur);
      setResendId(null);
      setResendTo("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao reenviar.");
    }
  }

  const hasDiagnostic = lead.diagnosticScore != null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(11,31,51,0.45)] p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-[760px] overflow-hidden rounded-[8px] border border-line bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-line px-6 py-4">
          <div>
            <h2 className="font-display text-lg text-azul-profundo">Relatório Preliminar CRIVO</h2>
            <p className="text-[12px] text-text-sec">
              {lead.name}{lead.company ? ` · ${lead.company}` : ""}
            </p>
          </div>
          <button
            className="rounded-[3px] border border-line bg-white px-3 py-1.5 text-[12px] text-text-sec hover:border-terra"
            onClick={onClose}
          >
            fechar
          </button>
        </div>

        <div className="max-h-[68vh] overflow-y-auto px-6 py-4">
          {!hasDiagnostic && (
            <div className="rounded-[4px] border border-line bg-[#fafaf7] p-3 text-[13px] text-text-sec">
              Este lead ainda não tem Diagnóstico Inicial preenchido. Aplique-o (LP / formulário) antes de gerar relatório.
            </div>
          )}

          {hasDiagnostic && (
            <div className="mb-6 rounded-[4px] border border-line bg-[#fafaf7] p-4">
              <h3 className="mb-2 font-display text-base text-azul-profundo">Gerar novo relatório</h3>
              <p className="mb-3 text-[13px] text-text-sec">
                Score: <strong className="text-text">{lead.diagnosticScore}/100</strong>. A IA usará o snapshot atual do diagnóstico.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="flex-1">
                  <span className="mb-1.5 block text-[11px] uppercase tracking-[0.1em] text-text-sec">
                    E-mail destinatário
                  </span>
                  <input
                    type="email"
                    value={sendTo}
                    onChange={(e) => setSendTo(e.target.value)}
                    placeholder="cliente@empresa.com"
                    className="w-full rounded-[3px] border border-line bg-white px-3 py-2 text-[14px] text-text outline-none focus:border-terra"
                  />
                </label>
                <button
                  className="rounded-[3px] border border-terra bg-terra px-4 py-2 text-[13px] font-medium text-white hover:bg-terra-dark disabled:opacity-50"
                  onClick={generate}
                  disabled={generating}
                >
                  {generating ? "Gerando…" : "Gerar com IA"}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-text-sec">
                Sem <code className="font-mono">RESEND_API_KEY</code> no servidor, o relatório fica como{" "}
                <em>PRONTO</em> e você pode reenviar manualmente.
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-[4px] border border-[#c2625b] bg-[#fdf5f4] p-3 text-[13px] text-[#9c4c46]">
              {error}{" "}
              <button onClick={load} className="ml-2 underline">recarregar</button>
            </div>
          )}

          <div>
            <h3 className="mb-3 font-display text-base text-azul-profundo">Histórico</h3>
            {reports === null && <p className="text-[13px] text-text-sec">Carregando…</p>}
            {reports && reports.length === 0 && (
              <p className="text-[13px] text-text-sec">
                Nenhum relatório de IA gerado ainda. O diagnóstico do lead já está salvo — use
                “Gerar relatório” acima quando quiser. O avanço do lead no funil não depende disto.
              </p>
            )}
            {reports && reports.map((r) => (
              <div key={r.id} className="mb-3 rounded-[6px] border border-line bg-white p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-display text-[15px] text-text">
                      {new Date(r.createdAt).toLocaleString("pt-BR")}
                    </h4>
                    <p className="text-[11px] text-text-sec">
                      Score {r.diagnosticScore} · Modelo {r.modelVersion} · Prompt {r.promptVersion}
                    </p>
                  </div>
                  <span className={`prelim-status prelim-status--${r.status.toLowerCase()}`}>
                    {PRELIMINARY_REPORT_STATUS_LABEL[r.status as PreliminaryReportStatus]}
                  </span>
                </div>

                {r.errorReason && (
                  <p className="my-2 rounded-[3px] border border-[#c2625b] bg-[#fdf5f4] p-2 text-[12px] text-[#9c4c46]">
                    {r.errorReason}
                  </p>
                )}

                {r.sentTo && r.sentAt && (
                  <p className="text-[12px] text-text-sec">
                    Enviado a <strong className="text-text">{r.sentTo}</strong> em{" "}
                    {new Date(r.sentAt).toLocaleString("pt-BR")} via {r.emailProvider ?? "—"}.
                  </p>
                )}

                {r.content && (
                  <>
                    <details className="mt-2" open>
                      <summary className="cursor-pointer text-[12px] text-azul-cobalto">Ver relatório</summary>
                      <div
                        className="rep-rendered mt-2 max-h-[360px] overflow-auto rounded-[6px] border border-line bg-white p-5"
                        dangerouslySetInnerHTML={{ __html: mdToHtml(r.content) }}
                      />
                    </details>
                    <button
                      type="button"
                      className="mt-2 inline-flex items-center gap-1.5 rounded-[3px] border border-terra bg-white px-3 py-1.5 text-[12px] font-medium text-terra hover:bg-terra hover:text-white"
                      onClick={() =>
                        exportReportPdf(
                          r.content,
                          `${lead.name}${lead.company ? " · " + lead.company : ""} — ${new Date(r.createdAt).toLocaleDateString("pt-BR")}`,
                        )
                      }
                    >
                      ⬇ Exportar PDF
                    </button>
                  </>
                )}

                {r.status !== "GERANDO" && r.status !== "ERRO" && (
                  <div className="mt-3">
                    {resendId === r.id ? (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          type="email"
                          placeholder="Reenviar para outro e-mail…"
                          value={resendTo}
                          onChange={(e) => setResendTo(e.target.value)}
                          className="flex-1 rounded-[3px] border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-terra"
                        />
                        <button
                          className="rounded-[3px] border border-terra bg-terra px-3 py-2 text-[12px] font-medium text-white hover:bg-terra-dark disabled:opacity-50"
                          onClick={() => resend(r.id)}
                          disabled={!resendTo.trim()}
                        >
                          Reenviar
                        </button>
                        <button
                          className="rounded-[3px] border border-line bg-white px-3 py-2 text-[12px] text-text-sec hover:border-terra"
                          onClick={() => { setResendId(null); setResendTo(""); }}
                        >
                          cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        className="text-[12px] text-azul-cobalto hover:underline"
                        onClick={() => { setResendId(r.id); setResendTo(r.sentTo ?? ""); }}
                      >
                        reenviar para outro e-mail
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
