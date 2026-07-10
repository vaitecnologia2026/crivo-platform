"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CONTRACT_STATUS_LABEL, type AddonSummary, type ContractStatus, type TenantSummary } from "@crivo/types";
import {
  deleteContractTemplate,
  listAddons,
  listAllContracts,
  listContractTemplates,
  listTenants,
  upsertAddon,
  uploadContractTemplate,
  type ContractListItem,
  type ContractTemplateSummary,
} from "../../lib/admin-api";
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

/** Tabela central de contratos — modelo aprovado ("Contratos e Liberações"). */
function ContractsTable() {
  const [rows, setRows] = useState<ContractListItem[] | null>(null);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [onlyAddons, setOnlyAddons] = useState(false);
  const [open, setOpen] = useState<{ tenant?: TenantSummary; group?: { id: string; name: string } } | null>(null);
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

  const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—");

  function openContract(r: ContractListItem) {
    if (r.byGroup && r.groupId) {
      setOpen({ group: { id: r.groupId, name: r.clientName } });
    } else if (r.tenantId) {
      const t = tenants.find((x) => x.id === r.tenantId);
      // ContractModal só lê id/name do tenant — o cast mínimo é seguro.
      setOpen({ tenant: t ?? ({ id: r.tenantId, name: r.clientName } as TenantSummary) });
    }
  }

  return (
    <div style={{ marginBottom: 28 }}>
      <div className="route__head">
        <div>
          <h1 className="page-title">Contratos e Liberações</h1>
          <p className="page-sub">
            Fonte de verdade das liberações do cliente. Soluções, módulos, adicionais, limites, IA, recursos e
            permissões são administrados aqui.
          </p>
        </div>
        <button className="btn btn--sm" onClick={() => setPickerOpen(true)}>Novo contrato</button>
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
                <th>MRR</th><th>Adicionais</th><th>Ciclos</th><th>Status</th><th>Abrir</th>
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
                  <td>{r.startDate || r.endDate ? `${fmt(r.startDate)} → ${fmt(r.endDate)}` : "—"}</td>
                  <td>{r.responsible ?? "—"}</td>
                  <td>{r.mrrCents > 0 ? brl(r.mrrCents) : "—"}</td>
                  <td>{r.addonsCount}</td>
                  <td>{r.rounds || "—"}</td>
                  <td><span className={STATUS_PILL[r.status] ?? "ct-pill"}>{CONTRACT_STATUS_LABEL[r.status as ContractStatus] ?? r.status}</span></td>
                  <td>
                    <button className="btn btn--ghost btn--sm" onClick={() => openContract(r)}>Ver →</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: "center", padding: 24 }} className="cell-mute">Nenhum contrato encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

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
                  if (t) { setPickerOpen(false); setOpen({ tenant: t }); }
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

      {open && (
        <ContractModal
          tenant={open.tenant}
          group={open.group}
          onClose={() => { setOpen(null); void refresh(); }}
        />
      )}
    </div>
  );
}

/** Painel de preços dos adicionais (Tela 05 · modelo Adicional c/ preço+recorrência). */
function AddonPricesPanel() {
  const [addons, setAddons] = useState<AddonSummary[] | null>(null);
  useEffect(() => {
    listAddons().then(setAddons).catch(() => setAddons([]));
  }, []);
  return (
    <div className="cnae-card" style={{ marginBottom: 18 }}>
      <h3 style={{ marginTop: 0 }}>Preços de adicionais</h3>
      <p className="cnae-muted" style={{ marginTop: 0 }}>
        Preço e recorrência de cada adicional. Entram no contrato (soluções + adicionais) e no
        faturamento/MRR quando o contrato está <strong>Ativo</strong>.
      </p>
      {!addons ? (
        <p className="cnae-muted">Carregando…</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr><th>Adicional</th><th>Mensal (R$)</th><th>Implantação (R$)</th><th>Recorrente</th><th></th></tr>
            </thead>
            <tbody>
              {addons.map((a) => (
                <AddonRow
                  key={a.moduleCode}
                  addon={a}
                  onSaved={(u) => setAddons((prev) => prev?.map((x) => (x.moduleCode === u.moduleCode ? u : x)) ?? prev)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AddonRow({ addon, onSaved }: { addon: AddonSummary; onSaved: (a: AddonSummary) => void }) {
  const [monthly, setMonthly] = useState(String(addon.monthlyPriceCents / 100));
  const [setup, setSetup] = useState(String(addon.setupPriceCents / 100));
  const [recurring, setRecurring] = useState(addon.recurring);
  const [saving, setSaving] = useState(false);
  const numStyle = { width: 90, font: "inherit", fontSize: 13, padding: "4px 6px", borderRadius: 6, border: "1px solid var(--line, #E3DDD3)" };
  async function save() {
    setSaving(true);
    try {
      const u = await upsertAddon(addon.moduleCode, {
        monthlyPriceCents: Math.round((Number(monthly) || 0) * 100),
        setupPriceCents: Math.round((Number(setup) || 0) * 100),
        recurring,
        active: true,
      });
      onSaved(u);
    } catch {
      /* mantém */
    } finally {
      setSaving(false);
    }
  }
  return (
    <tr>
      <td>
        <strong>{addon.label}</strong>
        <div className="cnae-muted" style={{ fontSize: 11 }}>{addon.moduleCode}{addon.configured ? "" : " · não precificado"}</div>
      </td>
      <td><input type="number" min={0} step="0.01" value={monthly} onChange={(e) => setMonthly(e.target.value)} style={numStyle} /></td>
      <td><input type="number" min={0} step="0.01" value={setup} onChange={(e) => setSetup(e.target.value)} style={numStyle} /></td>
      <td><input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} /></td>
      <td><button className="btn btn--terra btn--sm" disabled={saving} onClick={save}>{saving ? "…" : "Salvar"}</button></td>
    </tr>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result);
      resolve(s.includes(",") ? s.slice(s.indexOf(",") + 1) : s);
    };
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export function ContractsSection() {
  const [items, setItems] = useState<ContractTemplateSummary[]>([]);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    try {
      setItems(await listContractTemplates());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao carregar.");
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function upload() {
    if (!file) {
      setErr("Selecione um arquivo (PDF ou DOCX).");
      return;
    }
    if (file.size > MAX_BYTES) {
      setErr("Arquivo muito grande (máx. 8 MB).");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const data = await fileToBase64(file);
      await uploadContractTemplate({
        name: name.trim() || file.name,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        data,
      });
      setName("");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha no upload.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Remover este modelo de contrato?")) return;
    await deleteContractTemplate(id).catch(() => undefined);
    await refresh();
  }

  return (
    <div>
      <ContractsTable />

      <AddonPricesPanel />

      <h3 style={{ margin: "0 0 6px" }}>Modelo de contrato</h3>
      <p className="cnae-muted" style={{ marginTop: 0 }}>
        Suba aqui o <strong>modelo de contrato</strong> (PDF ou DOCX). Ele fica disponível para envio à assinatura
        (Clicksign) a partir do Onboarding da empresa.
      </p>
      {err && <div className="cnae-note cnae-block--warn">{err}</div>}

      <div className="cnae-card">
        <div className="ct-form">
          <label className="prod-field">
            <span>Nome do modelo</span>
            <input
              value={name}
              placeholder="Ex.: Contrato de Prestação de Serviço CRIVO"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="prod-field">
            <span>Arquivo (PDF/DOCX)</span>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button className="btn btn--terra btn--sm" disabled={busy || !file} onClick={upload}>
            {busy ? "Enviando…" : "Subir modelo"}
          </button>
        </div>
      </div>

      {loaded && items.length === 0 && <p className="cnae-muted" style={{ marginTop: 16 }}>Nenhum modelo carregado ainda.</p>}

      <ul className="ct-list">
        {items.map((t) => (
          <li key={t.id} className="ct-item">
            <div>
              <strong>{t.name}</strong>
              <div className="ct-item__meta">
                {t.fileName} · {new Date(t.createdAt).toLocaleDateString("pt-BR")}
              </div>
            </div>
            <button className="btn btn--ghost btn--sm" style={{ color: "var(--danger, #b4453a)" }} onClick={() => remove(t.id)}>
              Remover
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
