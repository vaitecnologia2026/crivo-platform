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

/** Traduz erros técnicos (SMTP/conexão/provedor) em mensagem amigável para o
 *  operador — nunca expõe stack/IP/porta crus na interface. */
function friendlyError(reason: string | null | undefined): { text: string; tone: "warn" | "error" } {
  const r = (reason ?? "").toLowerCase();
  if (
    r.includes("enetunreach") || r.includes("econnrefused") || r.includes("etimedout") ||
    r.includes(":465") || r.includes(":587") || r.includes("smtp") || r.includes("greeting") ||
    r.includes("socket") || r.includes("connection")
  ) {
    return {
      tone: "warn",
      text: "O envio por e-mail está indisponível no servidor (porta de SMTP bloqueada). O relatório foi gerado e está PRONTO — use “Reenviar” quando o e-mail estiver ativo, ou configure um provedor (RESEND_API_KEY).",
    };
  }
  if (r.includes("resend") || r.includes("api key") || r.includes("provider") || r.includes("provedor")) {
    return { tone: "warn", text: "Provedor de e-mail não configurado. O relatório está PRONTO — reenvie quando o e-mail estiver ativo." };
  }
  if (r.includes("ia ") || r.includes("token de ia") || r.includes("openai") || r.includes("modelo")) {
    return { tone: "error", text: reason ?? "Falha ao gerar com IA." };
  }
  return { tone: "error", text: reason ?? "Ocorreu um erro." };
}

// Exporta o relatório como PDF abrindo uma janela de impressão limpa.
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

const INPUT =
  "w-full rounded-[8px] border border-[#dcd7ce] bg-white px-3.5 py-2.5 text-[14px] text-[#0d1f3c] outline-none transition-colors focus:border-[#a8693d]";

/**
 * Briefing §5 / Portal §7 — modal de Relatório Preliminar CRIVO (redesenho premium).
 * Gera relatório via IA a partir do Diagnóstico Inicial do lead e dispara envio
 * por e-mail (fallback amigável se o provedor não estiver ativo).
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
  const [openId, setOpenId] = useState<string | null>(null);

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
      .then((d) => { if (alive) { setReports(d); setOpenId(d[0]?.id ?? null); } })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Falha ao carregar."); });
    return () => { alive = false; };
  }, [lead.id]);

  async function generate() {
    setError(null);
    setGenerating(true);
    try {
      const r = await generatePreliminaryReport({ platformLeadId: lead.id, sendTo: sendTo || undefined });
      setReports((cur) => [r, ...(cur ?? [])]);
      setOpenId(r.id);
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
  const subtitle = [lead.company, lead.segment, lead.employeesCount].filter(Boolean).join(" · ");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(11,31,51,0.55)] p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-[800px] flex-col overflow-hidden rounded-[16px] border border-[#dcd7ce] bg-[#f7f5f1] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho — faixa navy */}
        <div className="flex items-start justify-between gap-4 bg-[#0d1f3c] px-7 py-5">
          <div className="min-w-0">
            <span className="block text-[10px] font-medium uppercase tracking-[0.24em] text-[#c4894a]">
              Relatório preliminar
            </span>
            <h2 className="mt-1.5 truncate font-display text-[21px] leading-tight text-[#f2f0ec]">{lead.name}</h2>
            {subtitle && <p className="mt-0.5 truncate text-[12.5px] text-[#8bafd4]">{subtitle}</p>}
          </div>
          <button
            className="shrink-0 rounded-full border border-white/20 px-3.5 py-1.5 text-[12px] text-[#f2f0ec]/85 transition-colors hover:bg-white/10"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-7 py-6">
          {!hasDiagnostic && (
            <div className="rounded-[12px] border border-[#dcd7ce] bg-white p-5 text-[13.5px] leading-relaxed text-[#5c6470]">
              Este lead ainda não tem <strong className="text-[#0d1f3c]">Diagnóstico Inicial</strong> preenchido.
              Aplique-o (Landing Page ou formulário) antes de gerar o relatório.
            </div>
          )}

          {/* Gerar novo relatório */}
          {hasDiagnostic && (
            <div className="rounded-[14px] border border-[#dcd7ce] bg-white p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-[60px] w-[60px] shrink-0 flex-col items-center justify-center rounded-[12px] bg-[#c8d9ed]">
                  <strong className="font-display text-[23px] leading-none text-[#0d1f3c]">{lead.diagnosticScore}</strong>
                  <span className="mt-0.5 text-[9px] tracking-wide text-[#4a6fa5]">/100</span>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-[16px] text-[#0d1f3c]">Gerar novo relatório</h3>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-[#5c6470]">
                    A IA monta uma leitura executiva a partir do diagnóstico atual e a envia ao destinatário.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-end">
                <label className="flex-1">
                  <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.14em] text-[#5c6470]">
                    E-mail destinatário
                  </span>
                  <input type="email" value={sendTo} onChange={(e) => setSendTo(e.target.value)} placeholder="cliente@empresa.com" className={INPUT} />
                </label>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-[#a8693d] px-5 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-[#7b4f2e] disabled:opacity-50"
                  onClick={generate}
                  disabled={generating}
                >
                  {generating ? "Gerando…" : "Gerar com IA"}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-[10px] border border-[#e0b080] bg-[#fbf3e9] px-4 py-3 text-[13px] text-[#7b4f2e]">
              {friendlyError(error).text}{" "}
              <button onClick={load} className="font-medium underline underline-offset-2">recarregar</button>
            </div>
          )}

          {/* Histórico */}
          <div className="mb-3 mt-7 flex items-center gap-3">
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#5c6470]">Histórico de relatórios</span>
            <span className="h-px flex-1 bg-[#dcd7ce]" />
          </div>

          {reports === null && <p className="text-[13px] text-[#5c6470]">Carregando…</p>}
          {reports && reports.length === 0 && (
            <div className="rounded-[12px] border border-dashed border-[#dcd7ce] bg-white/60 p-5 text-[13px] leading-relaxed text-[#5c6470]">
              Nenhum relatório gerado ainda. O diagnóstico do lead já está salvo — gere acima quando quiser.
              O avanço do lead no funil não depende disto.
            </div>
          )}

          {reports && reports.map((r) => {
            const isOpen = openId === r.id;
            const isError = r.status === "ERRO";
            return (
              <article key={r.id} className="mb-4 overflow-hidden rounded-[14px] border border-[#dcd7ce] bg-white">
                <div className="flex items-start justify-between gap-3 border-b border-[#ece8e1] px-5 py-3.5">
                  <div className="min-w-0">
                    <h4 className="font-display text-[14.5px] text-[#0d1f3c]">
                      {new Date(r.createdAt).toLocaleString("pt-BR")}
                    </h4>
                    <p className="mt-0.5 text-[11px] text-[#5c6470]">
                      Score {r.diagnosticScore} · {r.modelVersion}
                    </p>
                  </div>
                  <span className={`prelim-status prelim-status--${r.status.toLowerCase()}`}>
                    {PRELIMINARY_REPORT_STATUS_LABEL[r.status as PreliminaryReportStatus]}
                  </span>
                </div>

                <div className="px-5 py-4">
                  {r.errorReason && (() => {
                    const fe = friendlyError(r.errorReason);
                    const warn = fe.tone === "warn";
                    return (
                      <div
                        className={`mb-3 flex gap-2.5 rounded-[10px] border px-3.5 py-2.5 text-[12.5px] leading-snug ${
                          warn ? "border-[#e0b080] bg-[#fbf3e9] text-[#7b4f2e]" : "border-[#e2b3b0] bg-[#fbf0ef] text-[#9c4c46]"
                        }`}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0" aria-hidden="true">
                          <path d="M12 8v5M12 16.5v.5M10.3 3.9 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>{fe.text}</span>
                      </div>
                    );
                  })()}

                  {r.sentTo && r.sentAt && (
                    <div className="mb-3 flex items-center gap-2 text-[12px] text-[#0f6e56]">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Enviado a <strong>{r.sentTo}</strong> em {new Date(r.sentAt).toLocaleString("pt-BR")} via {r.emailProvider ?? "—"}.
                    </div>
                  )}

                  {r.content && (
                    <>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between rounded-[8px] bg-[#f2f0ec] px-3.5 py-2.5 text-[12.5px] font-medium text-[#0d1f3c] transition-colors hover:bg-[#e9e6df]"
                        onClick={() => setOpenId(isOpen ? null : r.id)}
                        aria-expanded={isOpen}
                      >
                        {isOpen ? "Ocultar relatório" : "Ver relatório completo"}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={`transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true">
                          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      {isOpen && (
                        <div
                          className="rep-rendered mt-3 max-h-[380px] overflow-auto rounded-[10px] border border-[#ece8e1] bg-white p-5"
                          dangerouslySetInnerHTML={{ __html: mdToHtml(r.content) }}
                        />
                      )}
                    </>
                  )}

                  {/* Ações */}
                  {(r.content || (r.status !== "GERANDO" && !isError)) && (
                    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2.5">
                      {r.content && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#a8693d] transition-colors hover:text-[#7b4f2e]"
                          onClick={() =>
                            exportReportPdf(
                              r.content,
                              `${lead.name}${lead.company ? " · " + lead.company : ""} — ${new Date(r.createdAt).toLocaleDateString("pt-BR")}`,
                            )
                          }
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Exportar PDF
                        </button>
                      )}
                      {r.status !== "GERANDO" && !isError && (
                        resendId === r.id ? (
                          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                            <input type="email" placeholder="Reenviar para outro e-mail…" value={resendTo} onChange={(e) => setResendTo(e.target.value)} className={INPUT + " flex-1"} />
                            <button className="rounded-[8px] bg-[#a8693d] px-4 py-2.5 text-[12.5px] font-medium text-white transition-colors hover:bg-[#7b4f2e] disabled:opacity-50" onClick={() => resend(r.id)} disabled={!resendTo.trim()}>Reenviar</button>
                            <button className="rounded-[8px] border border-[#dcd7ce] bg-white px-4 py-2.5 text-[12.5px] text-[#5c6470] transition-colors hover:border-[#a8693d]" onClick={() => { setResendId(null); setResendTo(""); }}>Cancelar</button>
                          </div>
                        ) : (
                          <button className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#4a6fa5] transition-colors hover:text-[#1b3a6b]" onClick={() => { setResendId(r.id); setResendTo(r.sentTo ?? lead.email ?? ""); }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path d="M3 8l9 6 9-6M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Reenviar por e-mail
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
