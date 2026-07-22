"use client";

import { useEffect, useMemo, useState } from "react";
import type { ActionPlanData, EvidenceData } from "@crivo/types";
import { listActionPlans } from "@/lib/api";

/**
 * Evidências — repositório dedicado (mockup Portal do Cliente 22/07).
 * "Repositório de comprovações vinculadas a ações e diagnósticos."
 * Consolida as evidências de TODOS os planos/ações num só lugar (o anexo
 * continua sendo feito na ação, dentro do Plano de Evolução — dado único,
 * sem duplicação: aqui só se consome/apresenta).
 */
export function EvidenciasScreen() {
  const [plans, setPlans] = useState<ActionPlanData[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [kind, setKind] = useState("");

  useEffect(() => {
    listActionPlans()
      .then(setPlans)
      .catch((e) => setErr(e instanceof Error ? e.message : "Falha ao carregar evidências."));
  }, []);

  type Row = { ev: EvidenceData; acao: string; plano: string };
  const rows: Row[] = useMemo(() => {
    if (!plans) return [];
    const out: Row[] = [];
    for (const p of plans)
      for (const i of p.items)
        for (const ev of i.evidences) out.push({ ev, acao: i.action, plano: p.title });
    return out.sort((a, b) => (a.ev.createdAt < b.ev.createdAt ? 1 : -1));
  }, [plans]);

  const kinds = useMemo(() => [...new Set(rows.map((r) => r.ev.kind))].sort(), [rows]);
  const filtered = kind ? rows.filter((r) => r.ev.kind === kind) : rows;
  const uploads = rows.filter((r) => r.ev.fileName).length;

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Evidências</h1>
          <p className="page-sub">
            Repositório de comprovações vinculadas a ações e diagnósticos. O envio é feito na
            própria ação, no <strong>Plano de Evolução</strong> — aqui fica a visão consolidada.
          </p>
        </div>
      </div>

      {err && <div className="dash-state dash-state--error">{err}</div>}
      {!plans && !err && <p className="dash-state">Carregando evidências…</p>}

      {plans && (
        <>
          <div className="kpi-grid" style={{ marginBottom: 16 }}>
            <div className="kpi"><span className="kpi__label">Evidências</span><span className="kpi__value">{rows.length}</span></div>
            <div className="kpi"><span className="kpi__label">Tipos</span><span className="kpi__value">{kinds.length}</span></div>
            <div className="kpi"><span className="kpi__label">Arquivos enviados</span><span className="kpi__value">{uploads}</span></div>
            <div className="kpi"><span className="kpi__label">Links/registros</span><span className="kpi__value">{rows.length - uploads}</span></div>
          </div>

          <div className="card">
            <div className="card__head">
              <h3>Repositório</h3>
              <select className="kb-stage-select" value={kind} onChange={(e) => setKind(e.target.value)} style={{ width: 180 }}>
                <option value="">Tipo: todos</option>
                {kinds.map((k) => (<option key={k} value={k}>{k}</option>))}
              </select>
            </div>
            {filtered.length === 0 ? (
              <p className="dash-state">
                Nenhuma evidência ainda. Anexe comprovações às ações do Plano de Evolução — elas
                aparecem aqui automaticamente.
              </p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>Evidência</th><th>Tipo</th><th>Vínculo (ação)</th><th>Plano</th><th>Data</th><th>Acesso</th></tr>
                </thead>
                <tbody>
                  {filtered.map(({ ev, acao, plano }) => (
                    <tr key={ev.id}>
                      <td><strong>{ev.title}</strong>{ev.note && <span className="card__sub"> · {ev.note}</span>}</td>
                      <td>{ev.kind}</td>
                      <td>{acao}</td>
                      <td className="cell-mute">{plano}</td>
                      <td>{new Date(ev.createdAt).toLocaleDateString("pt-BR")}</td>
                      <td>
                        {ev.url ? (
                          <a className="link-gold" href={ev.url} target="_blank" rel="noopener">Abrir link</a>
                        ) : ev.fileName ? (
                          <span className="cell-mute">{ev.fileName}</span>
                        ) : (
                          <span className="cell-na">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </>
  );
}
