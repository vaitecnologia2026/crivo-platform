"use client";

import { useEffect, useRef, useState } from "react";
import { type AddonSummary } from "@crivo/types";
import {
  deleteContractTemplate,
  listAddons,
  listContractTemplates,
  upsertAddon,
  uploadContractTemplate,
  type ContractTemplateSummary,
} from "../../lib/admin-api";
import "./cnae.css";

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
