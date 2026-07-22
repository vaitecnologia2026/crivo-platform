"use client";

import { useEffect, useState } from "react";
import { getDiagnosticContext, getMyModules, type DiagnosticContext } from "@/lib/api";

const METHOD_LABEL: Record<string, string> = {
  INICIAL: "Diagnóstico Inicial",
  ESSENCIAL: "Diagnóstico Essencial",
  ORGANIZACIONAL: "Diagnóstico Organizacional",
};
const OUTPUT_LABEL: Record<string, string> = {
  SEM_INTEGRACAO: "Sem integração formal",
  AEP: "Apoio à AEP",
  AEP_PGR: "Apoio à AEP + GRO/PGR",
};
const MODULE_LABEL: Record<string, string> = {
  dashboard: "Visão Geral", icd: "ICD / Liderança", campanhas: "Diagnósticos e Campanhas",
  parecer: "Parecer CRIVO", relatorios: "Plano, Evidências e Relatórios", lider: "Área do Líder",
  pocket: "Pocket CRIVO", mentorias: "Mentorias e Agenda", biblioteca: "Academia e Recursos",
  analytics: "People Analytics", custo: "Radar de Custos Invisíveis", historico: "Histórico & Auditoria",
  grupo: "Consolidado do Grupo",
};

/**
 * Minha Contratação (mockup Portal do Cliente 22/07): o cliente enxerga o que o
 * CONTRATO ativa — método, saídas técnicas e módulos liberados. Fonte única =
 * contrato ativo (mesmo contexto que governa o portal inteiro); nada editável
 * aqui — expansão é conversa comercial.
 */
export function ContratacaoScreen() {
  const [ctx, setCtx] = useState<DiagnosticContext | null>(null);
  const [mods, setMods] = useState<string[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getDiagnosticContext(), getMyModules()])
      // §16: CRM é ferramenta interna da CRIVO — não é entrega do portal.
      .then(([c, m]) => { setCtx(c); setMods(m.filter((x) => x !== "crm")); })
      .catch((e) => setErr(e instanceof Error ? e.message : "Falha ao carregar a contratação."));
  }, []);

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Minha Contratação</h1>
          <p className="page-sub">Pacote atual, método de diagnóstico e módulos liberados pelo contrato.</p>
        </div>
      </div>

      {err && <div className="dash-state dash-state--error">{err}</div>}
      {!ctx && !err && <p className="dash-state">Carregando…</p>}

      {ctx && mods && (
        <>
          <div className="grid grid--2">
            <div className="card">
              <div className="card__head"><h3>Solução contratada</h3></div>
              <p style={{ fontSize: 18, fontFamily: "var(--font-display)", margin: "4px 0 10px" }}>
                {ctx.productName ?? "Solução CRIVO"}
              </p>
              <table className="data-table">
                <tbody>
                  <tr><td className="cell-mute">Método de diagnóstico</td><td><strong>{ctx.method ? METHOD_LABEL[ctx.method] ?? ctx.method : "—"}</strong></td></tr>
                  <tr>
                    <td className="cell-mute">Saídas técnicas</td>
                    <td>{ctx.technicalOutputs.length ? ctx.technicalOutputs.map((o) => OUTPUT_LABEL[o] ?? o).join(" · ") : "—"}</td>
                  </tr>
                  <tr><td className="cell-mute">Módulos ativos</td><td><strong>{mods.length}</strong></td></tr>
                </tbody>
              </table>
            </div>
            <div className="card">
              <div className="card__head"><h3>Módulos liberados</h3></div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {mods.length === 0 && <span className="cell-mute">Nenhum módulo ativo — fale com a CRIVO.</span>}
                {mods.map((m) => (
                  <span key={m} className="pill" style={{ fontSize: 12 }}>{MODULE_LABEL[m] ?? m}</span>
                ))}
              </div>
              <p className="card__sub" style={{ marginTop: 14 }}>
                A liberação é governada pelo contrato ativo — itens fora do pacote não aparecem no menu.
              </p>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="card__head"><h3>Quer ampliar o programa?</h3></div>
            <p className="card__sub" style={{ marginBottom: 12 }}>
              Governança de IA, Workforce Intelligence, IA Contextualizada e novas jornadas são
              contratáveis como expansão do pacote atual.
            </p>
            <a
              className="btn btn--gold btn--sm"
              href="https://wa.me/5511918531796?text=Quero%20ampliar%20minha%20contrata%C3%A7%C3%A3o%20CRIVO"
              target="_blank" rel="noopener"
            >
              Falar com o time CRIVO
            </a>
          </div>
        </>
      )}
    </>
  );
}
