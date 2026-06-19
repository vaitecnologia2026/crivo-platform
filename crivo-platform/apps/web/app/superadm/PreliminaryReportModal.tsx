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
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[12px] text-azul-cobalto">Ver conteúdo</summary>
                    <pre className="prelim-content mt-2 max-h-[300px] overflow-auto rounded-[3px] border border-line bg-[#fafaf7] p-3 text-[12px] leading-[1.6] text-text whitespace-pre-wrap font-body">
                      {r.content}
                    </pre>
                  </details>
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
