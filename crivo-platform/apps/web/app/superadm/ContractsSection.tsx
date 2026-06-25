"use client";

import { useEffect, useRef, useState } from "react";
import {
  deleteContractTemplate,
  listContractTemplates,
  uploadContractTemplate,
  type ContractTemplateSummary,
} from "../../lib/admin-api";
import "./cnae.css";

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
