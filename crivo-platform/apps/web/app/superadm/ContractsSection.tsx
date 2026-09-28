"use client";

import { useEffect, useMemo, useState } from "react";
import { CONTRACT_STATUS_LABEL, type ContractStatus, type TenantSummary } from "@crivo/types";
import { listAllContracts, listTenants, type ContractListItem } from "../../lib/admin-api";
import { ContractDetail } from "./ContractDetail";
import { ContractModal } from "./ContractModal";
import "./cnae.css";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const STATUS_PILL: Record<string, string> = {
  RASCUNHO: "ct-pill ct-pill--rascunho",
  ATIVO: "ct-pill ct-pill--ativo",
  SUSPENSO: "ct-pill ct-pill--suspenso",
  ENCERRADO: "ct-pill ct-pill--encerrado",
};

/** Contratos e Liberações (protótipo Lovable /contratos): lista central de
 *  contratos; "Ver →" abre a ficha do contrato com as 4 abas oficiais
 *  (ContractDetail). O modelo de contrato (Clicksign) fica na aba Comercial. */
export function ContractsSection() {
  const [rows, setRows] = useState<ContractListItem[] | null>(null);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [onlyAddons, setOnlyAddons] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [creating, setCreating] = useState<TenantSummary | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  async function refresh() {
    try {
      setRows(await listAllContracts());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar contratos.");
    }
  }
  useEffect(() => {
    void refresh();
    listTenants().then(setTenants).catch(() => undefined);
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status && r.status !== status) return false;
      if (onlyAddons && r.addonsCount === 0) return false;
      if (term && !r.clientName.toLowerCase().includes(term) && !r.shortId.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [rows, q, status, onlyAddons]);

  // timeZone UTC: as datas do contrato são date-only (meia-noite UTC). Sem isto,
  // em fuso negativo (UTC-3) o toLocaleDateString exibia o dia anterior.
  const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "UTC" }) : "—");

  const detail = detailId ? rows?.find((r) => r.id === detailId) ?? null : null;
  if (detail) {
    const tenant = detail.tenantId ? tenants.find((t) => t.id === detail.tenantId) : undefined;
    return (
      <ContractDetail
        key={detail.id}
        row={detail}
        tenants={tenants}
        groupName={tenant?.groupName ?? null}
        onBack={() => setDetailId(null)}
        onChanged={() => void refresh()}
      />
    );
  }

  return (
    <div>
      <div className="route__head">
        <div>
          <h1 className="page-title">Contratos e Liberações</h1>
          <p className="page-sub">
            Fonte de verdade das liberações do cliente. Soluções, módulos, adicionais, limites, IA, recursos e
            permissões são administrados aqui.
          </p>
        </div>
        <button className="btn btn--gold btn--sm" onClick={() => setPickerOpen(true)}>Novo contrato</button>
      </div>

      <div className="ct-filters">
        <input
          className="ct-search"
          placeholder="Buscar cliente ou ID"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {Object.entries(CONTRACT_STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <button
          type="button"
          className={`ct-chip${onlyAddons ? " is-on" : ""}`}
          aria-pressed={onlyAddons}
          onClick={() => setOnlyAddons((v) => !v)}
        >
          Com adicionais
        </button>
      </div>

      {error && <div className="dash-state dash-state--error">{error}</div>}
      {rows === null && !error && <p className="dash-state">Carregando contratos…</p>}

      {rows !== null && (
        <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          <table className="data-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Contrato</th><th>Cliente</th><th>Vigência</th><th>Responsável</th>
                <th>MRR</th><th>Adicionais</th><th>Ciclo</th><th>Status</th><th style={{ textAlign: "right" }}>Abrir</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td><code className="cell-code">{r.shortId}</code></td>
                  <td>
                    <strong>{r.clientName}</strong>
                    {r.byGroup && <span className="cell-mute"> · grupo</span>}
                  </td>
                  <td className="cell-mute">{r.startDate || r.endDate ? `${fmt(r.startDate)} → ${fmt(r.endDate)}` : "—"}</td>
                  <td>{r.responsible ?? "—"}</td>
                  <td>{r.mrrCents > 0 ? brl(r.mrrCents) : "—"}</td>
                  <td>{r.addonsCount}</td>
                  <td>{r.rounds || "—"}</td>
                  <td><span className={STATUS_PILL[r.status] ?? "ct-pill"}>{CONTRACT_STATUS_LABEL[r.status as ContractStatus] ?? r.status}</span></td>
                  <td style={{ textAlign: "right" }}>
                    <button className="ge-link" onClick={() => setDetailId(r.id)}>Ver →</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: "center", padding: 24 }} className="cell-mute">Sem contratos neste filtro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="gd-rulebox">
        <div className="gd-rulebox__title">Regras desta tela</div>
        Cada contrato é a <b>fonte de verdade</b> das liberações do cliente. Alterações em módulo, adicional, IA, limite,
        CNPJ, recurso ou permissão geram evento em <b>Auditoria</b>. Contrato em rascunho não libera portal; contrato
        ativo libera apenas o contratado. O modelo de contrato para assinatura fica na aba Comercial de cada contrato.
      </div>

      {pickerOpen && (
        <div className="modal-backdrop" onClick={() => setPickerOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal__head"><h2>Novo contrato</h2></div>
            <div className="modal__body">
              <p className="cnae-muted" style={{ marginTop: 0 }}>Escolha a empresa — o contrato é criado/editado na ficha dela.</p>
              <select
                style={{ width: "100%" }}
                defaultValue=""
                onChange={(e) => {
                  const t = tenants.find((x) => x.id === e.target.value);
                  if (t) { setPickerOpen(false); setCreating(t); }
                }}
              >
                <option value="" disabled>Selecione a empresa…</option>
                {tenants.filter((t) => t.status !== "DELETED").map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {creating && (
        <ContractModal
          tenant={creating}
          onClose={() => { setCreating(null); void refresh(); }}
        />
      )}
    </div>
  );
}
