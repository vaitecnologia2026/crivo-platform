"use client";

import { useEffect, useRef, useState } from "react";
import type { EbookAssetSummary } from "@crivo/types";
import { getEbook, uploadEbook } from "../../lib/admin-api";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB — mesmo teto aplicado no servidor

/** Converte o arquivo escolhido em base64 puro (sem o prefixo data:). */
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

/** Tamanho legível (o servidor guarda o número exato em bytes). */
function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} bytes`;
}

/**
 * Governança · E-book — importa o e-book complementar que é disparado ao lead
 * por e-mail (vai anexado ao Relatório Preliminar) e por WhatsApp (vai o link
 * público do arquivo).
 *
 * Guarda UM arquivo: importar de novo substitui o anterior. Enquanto nada for
 * importado, o sistema continua enviando o PDF publicado na LP, exatamente como
 * antes desta tela existir.
 */
export function EbookSection() {
  const [current, setCurrent] = useState<EbookAssetSummary | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    try {
      setCurrent(await getEbook());
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao carregar o e-book.");
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function importar() {
    if (!file) {
      setErr("Selecione o arquivo do e-book (PDF).");
      return;
    }
    if (file.size > MAX_BYTES) {
      setErr("Arquivo muito grande (máx. 8 MB).");
      return;
    }
    setBusy(true);
    setErr(null);
    setOkMsg(null);
    try {
      const data = await fileToBase64(file);
      const saved = await uploadEbook({
        name: name.trim() || file.name,
        fileName: file.name,
        mimeType: file.type || "application/pdf",
        data,
      });
      setCurrent(saved);
      setOkMsg(
        "E-book importado. A partir de agora é este arquivo que vai anexado no e-mail e " +
          "linkado no WhatsApp enviados ao lead.",
      );
      setName("");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao importar o e-book.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="route__head">
        <div>
          <h1 className="page-title">E-book</h1>
          <p className="page-sub">
            Importe aqui o e-book complementar disparado ao lead. Ele vai <strong>anexado</strong>{" "}
            no e-mail do Relatório Preliminar e como <strong>link</strong> na mensagem de WhatsApp.
          </p>
        </div>
      </div>

      <div className="adm-callout">
        <strong>Um arquivo por vez.</strong> Importar um novo e-book{" "}
        <strong>substitui</strong> o atual — o disparo precisa de um único e-book corrente, sem
        ambiguidade sobre qual sai. Enquanto nenhum arquivo for importado, o sistema continua
        enviando o PDF publicado na LP, exatamente como antes.
      </div>

      {err && <div className="dash-state dash-state--error">{err}</div>}
      {okMsg && <div className="pu-temp">{okMsg}</div>}

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card__head">
          <div>
            <h3>E-book em uso</h3>
            <span className="card__sub">É este o arquivo que os leads recebem hoje.</span>
          </div>
        </div>

        {!loaded && <p className="dash-state">Carregando…</p>}

        {loaded && !current && (
          <p className="cnae-muted">
            Nenhum e-book importado ainda — os disparos seguem usando o PDF publicado na LP.
          </p>
        )}

        {loaded && current && (
          <table className="data-table">
            <tbody>
              <tr>
                <th style={{ width: 200 }}>Nome</th>
                <td><strong>{current.name}</strong></td>
              </tr>
              <tr>
                <th>Arquivo</th>
                <td className="cell-mute">
                  {current.fileName} · {fmtSize(current.sizeBytes)} · {current.mimeType}
                </td>
              </tr>
              <tr>
                <th>Importado em</th>
                <td className="cell-mute">
                  {new Date(current.updatedAt).toLocaleString("pt-BR")}
                </td>
              </tr>
              <tr>
                <th>Link enviado no WhatsApp</th>
                <td>
                  <a href={current.publicUrl} target="_blank" rel="noreferrer">
                    {current.publicUrl}
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card__head">
          <div>
            <h3>Importar e-book</h3>
            <span className="card__sub">Arquivo em PDF, até 8 MB.</span>
          </div>
        </div>

        <div className="ct-form">
          <label className="prod-field">
            <span>Nome do e-book</span>
            <input
              value={name}
              placeholder="Ex.: E-book CRIVO — Liderança que sustenta decisões"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="prod-field">
            <span>Arquivo (PDF)</span>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button className="btn btn--terra btn--sm" disabled={busy || !file} onClick={importar}>
            {busy ? "Importando…" : current ? "Substituir e-book" : "Importar e-book"}
          </button>
        </div>
      </div>
    </div>
  );
}
