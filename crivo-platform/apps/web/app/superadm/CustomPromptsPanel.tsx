"use client";

import { useEffect, useRef, useState } from "react";
import type {
  AddonSummary,
  AiCustomPromptData,
  AiCustomPromptFileMeta,
  AiPromptInstrumentOption,
} from "@crivo/types";
import {
  createAiCustomPrompt,
  deleteAiCustomPrompt,
  deleteAiCustomPromptFile,
  listAddons,
  listAiCustomPrompts,
  listAiPromptInstrumentOptions,
  testAiCustomPrompt,
  updateAiCustomPrompt,
  uploadAiCustomPromptFile,
} from "@/lib/admin-api";

/** Limite do upload no cliente — o servidor aplica o mesmo teto de 8 MB. */
const MAX_FILE_BYTES = 8 * 1024 * 1024;

const ACCEPTED_EXTENSIONS = ".pdf,.txt,.docx,.xlsx,.xls,.csv,.md";

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

type EditorState = {
  id: string | null; // null = prompt novo (ainda não salvo)
  name: string;
  body: string;
  instrumentSlug: string; // "" = sem vínculo
  addonIds: string[];
  active: boolean;
  files: AiCustomPromptFileMeta[];
};

const EMPTY_EDITOR: EditorState = {
  id: null,
  name: "",
  body: "",
  instrumentSlug: "",
  addonIds: [],
  active: true,
  files: [],
};

/**
 * Prompts personalizados da IA (aba Prompts e Políticas): prompt livre do super
 * admin, com vínculo opcional a um diagnóstico do Motor e a adicionais, material
 * de referência anexado (texto extraído no servidor) e teste na IA real.
 */
export function CustomPromptsPanel() {
  const [prompts, setPrompts] = useState<AiCustomPromptData[]>([]);
  const [options, setOptions] = useState<AiPromptInstrumentOption[]>([]);
  const [addons, setAddons] = useState<AddonSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileMsg, setFileMsg] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [question, setQuestion] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    try {
      const [p, o, a] = await Promise.all([
        listAiCustomPrompts(),
        listAiPromptInstrumentOptions(),
        listAddons(),
      ]);
      setPrompts(p);
      setOptions(o);
      setAddons(a);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }
  useEffect(() => { void load(); }, []);

  function instrumentLabel(slug: string | null): string {
    if (!slug) return "—";
    return options.find((o) => o.slug === slug)?.label ?? slug;
  }

  function openNew() {
    setEditor({ ...EMPTY_EDITOR });
    setTestResult(null);
    setQuestion("");
    setFileMsg(null);
  }

  function openEdit(p: AiCustomPromptData) {
    setEditor({
      id: p.id,
      name: p.name,
      body: p.body,
      instrumentSlug: p.instrumentSlug ?? "",
      addonIds: p.addonIds,
      active: p.active,
      files: p.files,
    });
    setTestResult(null);
    setQuestion("");
    setFileMsg(null);
  }


  async function save() {
    if (!editor) return;
    if (!editor.name.trim()) { alert("Informe o nome do prompt."); return; }
    if (!editor.body.trim()) { alert("Informe o conteúdo do prompt."); return; }
    setSaving(true);
    setSavedMsg(false);
    try {
      const payload = {
        name: editor.name,
        body: editor.body,
        // "" no seletor = limpar/sem vínculo (o servidor normaliza para null).
        instrumentSlug: editor.instrumentSlug,
        addonIds: editor.addonIds,
        active: editor.active,
      };
      const saved = editor.id
        ? await updateAiCustomPrompt(editor.id, payload)
        : await createAiCustomPrompt(payload);
      // Mantém o editor aberto em modo EDIÇÃO (permite anexar/testar em seguida).
      setEditor({
        id: saved.id,
        name: saved.name,
        body: saved.body,
        instrumentSlug: saved.instrumentSlug ?? "",
        addonIds: saved.addonIds,
        active: saved.active,
        files: saved.files,
      });
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao salvar o prompt");
    } finally {
      setSaving(false);
    }
  }

  async function removePrompt(p: AiCustomPromptData) {
    if (!confirm(`Excluir o prompt "${p.name}"? Os anexos também serão removidos.`)) return;
    try {
      await deleteAiCustomPrompt(p.id);
      if (editor?.id === p.id) setEditor(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao excluir");
    }
  }

  async function onFileChosen(file: File | null) {
    if (!file || !editor?.id) return;
    const promptId = editor.id;
    setFileMsg(null);
    if (file.size > MAX_FILE_BYTES) {
      setFileMsg(`✕ "${file.name}" excede 8 MB (${formatBytes(file.size)}).`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const url = String(reader.result ?? "");
          const comma = url.indexOf(",");
          resolve(comma >= 0 ? url.slice(comma + 1) : url);
        };
        reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
        reader.readAsDataURL(file);
      });
      const meta = await uploadAiCustomPromptFile(promptId, {
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        dataBase64,
      });
      setEditor((e) => (e && e.id === promptId ? { ...e, files: [...e.files, meta] } : e));
      setFileMsg(`✓ "${file.name}" anexado.`);
      await load();
    } catch (e) {
      setFileMsg(`✕ ${e instanceof Error ? e.message : "Falha no upload"}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeFile(fileId: string, filename: string) {
    if (!editor?.id) return;
    if (!confirm(`Remover o anexo "${filename}"?`)) return;
    const promptId = editor.id;
    try {
      await deleteAiCustomPromptFile(promptId, fileId);
      setEditor((e) =>
        e && e.id === promptId ? { ...e, files: e.files.filter((f) => f.id !== fileId) } : e,
      );
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao remover o anexo");
    }
  }

  async function runTest() {
    if (!editor?.id) return;
    setTesting(true);
    setTestResult(null);
    try {
      const r = await testAiCustomPrompt(editor.id, question.trim() || undefined);
      setTestResult(r.ok ? r.content ?? "" : `✕ ${r.error ?? "Falha no teste"}`);
    } catch (e) {
      setTestResult(`✕ ${e instanceof Error ? e.message : "Falha no teste"}`);
    } finally {
      setTesting(false);
    }
  }

  if (status === "loading") return <p className="dash-state">Carregando prompts personalizados…</p>;
  if (status === "error") {
    return <div className="dash-state dash-state--error">Não foi possível carregar os prompts personalizados.</div>;
  }

  const saved = !!editor?.id;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <p className="prod-note" style={{ margin: 0 }}>
          <strong>Prompts personalizados.</strong> Prompt livre do super admin — pode ser vinculado a um
          diagnóstico do Motor e a adicionais, receber material de referência (PDF, Word, Excel, texto) e
          ser testado na IA real antes de valer.
        </p>
        <button className="btn btn--terra btn--sm" onClick={openNew}>Novo prompt</button>
      </div>

      <div className="addx-wrap" style={{ marginBottom: 18 }}>
        <table className="addx-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Diagnóstico</th>
              <th>Adicionais</th>
              <th>Arquivos</th>
              <th>Atualizado</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {prompts.map((p) => (
              <tr key={p.id}>
                <td className="addx-name">
                  <strong>{p.name}</strong>
                  {!p.active && <span className="sol-chip" style={{ marginLeft: 8 }}>inativo</span>}
                </td>
                <td>{instrumentLabel(p.instrumentSlug)}</td>
                <td>{p.addonIds.length}</td>
                <td>{p.files.length}</td>
                <td style={{ whiteSpace: "nowrap" }}>{new Date(p.updatedAt).toLocaleString("pt-BR")}</td>
                <td>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn--outline-dark btn--sm" onClick={() => openEdit(p)}>Editar</button>
                    <button
                      className="btn btn--ghost btn--sm"
                      style={{ color: "var(--danger, #b4453a)" }}
                      onClick={() => removePrompt(p)}
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {prompts.length === 0 && (
              <tr><td colSpan={6} className="addx-empty">Nenhum prompt personalizado ainda — crie o primeiro em “Novo prompt”.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editor && (
        <div className="card" style={{ maxWidth: 720, marginBottom: 18 }}>
          <fieldset className="prod-fs">
            <legend>{editor.id ? "Editar prompt personalizado" : "Novo prompt personalizado"}</legend>

            <div className="prod-form__grid">
              <label className="prod-field prod-field--full">
                <span>Nome</span>
                <input
                  value={editor.name}
                  maxLength={160}
                  onChange={(e) => setEditor((s) => (s ? { ...s, name: e.target.value } : s))}
                  placeholder="Ex.: Dossiê NR-1 com metodologia própria"
                />
              </label>
              <label className="prod-field prod-field--full">
                <span>Prompt</span>
                <textarea
                  rows={10}
                  style={{ width: "100%", fontFamily: "var(--font-mono, monospace)", fontSize: 12, lineHeight: 1.5, resize: "vertical" }}
                  value={editor.body}
                  onChange={(e) => setEditor((s) => (s ? { ...s, body: e.target.value } : s))}
                  placeholder="Instruções completas para a IA…"
                />
              </label>
              <label className="prod-field">
                <span>Diagnóstico do Motor</span>
                <SearchSelect
                  placeholder="— Nenhum —"
                  options={options.map((o) => ({ value: o.slug, label: o.label }))}
                  value={editor.instrumentSlug ? [editor.instrumentSlug] : []}
                  onChange={(v) => setEditor((s) => (s ? { ...s, instrumentSlug: v[0] ?? "" } : s))}
                />
              </label>
            </div>

            <label className="prod-check" style={{ margin: "10px 0 0" }}>
              <input
                type="checkbox"
                checked={editor.active}
                onChange={(e) => setEditor((s) => (s ? { ...s, active: e.target.checked } : s))}
              />
              Prompt ativo (só prompts ativos são usados na geração)
            </label>

            <span className="prod-note" style={{ display: "block", margin: "12px 0 6px" }}>
              Adicionais contratados vinculados a este prompt:
            </span>
            <SearchSelect
              multiple
              placeholder="Selecionar adicionais…"
              emptyLabel="Nenhum adicional no catálogo."
              options={addons.map((a) => ({ value: a.moduleCode, label: a.label }))}
              value={editor.addonIds}
              onChange={(v) => setEditor((s) => (s ? { ...s, addonIds: v } : s))}
            />
          </fieldset>

          <fieldset className="prod-fs" style={{ marginTop: 14 }}>
            <legend>Anexos (material de referência)</legend>
            {!saved && (
              <p className="prod-note" style={{ marginTop: 0 }}>
                Salve o prompt para anexar arquivos.
              </p>
            )}
            {saved && (
              <>
                <p className="prod-note" style={{ marginTop: 0 }}>
                  O texto do arquivo é extraído no servidor e entra como material de referência no prompt.
                  Formatos: PDF, Word (.docx), Excel (.xlsx/.xls), .txt, .md, .csv — máx. 8 MB.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_EXTENSIONS}
                  disabled={uploading}
                  onChange={(e) => void onFileChosen(e.target.files?.[0] ?? null)}
                />
                {uploading && <p className="dash-state" style={{ marginTop: 8 }}>Enviando e extraindo o texto…</p>}
                {fileMsg && <p className="prod-note" style={{ marginTop: 8 }}>{fileMsg}</p>}
                {editor.files.length > 0 && (
                  <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "flex", flexDirection: "column", gap: 6 }}>
                    {editor.files.map((f) => (
                      <li key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13 }}>
                          <strong>{f.filename}</strong>{" "}
                          <span className="cell-mute">· {formatBytes(f.sizeBytes)}</span>
                        </span>
                        <button
                          className="btn btn--ghost btn--sm"
                          style={{ color: "var(--danger, #b4453a)" }}
                          onClick={() => removeFile(f.id, f.filename)}
                        >
                          Remover
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </fieldset>

          <fieldset className="prod-fs" style={{ marginTop: 14 }}>
            <legend>Testar</legend>
            {!saved && (
              <p className="prod-note" style={{ marginTop: 0 }}>
                Salve o prompt para testar na IA.
              </p>
            )}
            {saved && (
              <>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    value={question}
                    maxLength={4000}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Pergunta de teste (opcional)"
                    style={{ flex: "1 1 260px" }}
                  />
                  <button className="btn btn--outline-dark btn--sm" disabled={testing} onClick={runTest}>
                    {testing ? "Testando…" : "Testar"}
                  </button>
                </div>
                {testResult !== null && (
                  <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, lineHeight: 1.55, marginTop: 10, maxHeight: 320, overflow: "auto" }}>
                    {testResult}
                  </pre>
                )}
              </>
            )}
          </fieldset>

          <div style={{ display: "flex", gap: 10, marginTop: 16, alignItems: "center" }}>
            <button className="btn btn--terra btn--sm" disabled={saving} onClick={save}>
              {saving ? "Salvando…" : "Salvar prompt"}
            </button>
            <button className="btn btn--ghost btn--sm" disabled={saving} onClick={() => setEditor(null)}>
              Cancelar
            </button>
            {savedMsg && <span className="kb-converted">✓ Salvo</span>}
          </div>
        </div>
      )}
    </>
  );
}

/** Dropdown com busca (único ou multi). Substitui o <select>/checkbox-grid:
 *  filtra por texto, chips no modo multi, fecha ao clicar fora. Estilos inline
 *  para não depender de CSS novo, usando os tokens do tema. */
function SearchSelect({
  options,
  value,
  onChange,
  placeholder,
  multiple = false,
  emptyLabel = "Nada encontrado.",
}: {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  multiple?: boolean;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const term = q.trim().toLowerCase();
  const filtered = term ? options.filter((o) => o.label.toLowerCase().includes(term)) : options;
  const selected = options.filter((o) => value.includes(o.value));
  const summary = multiple
    ? value.length
      ? `${value.length} selecionado(s)`
      : placeholder
    : selected[0]?.label ?? placeholder;
  const pick = (v: string) => {
    if (multiple) onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
    else {
      onChange([v]);
      setOpen(false);
      setQ("");
    }
  };
  const hasSel = multiple ? value.length > 0 : selected.length > 0;
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "8px 12px",
          border: "1px solid var(--line, #DCD7CE)",
          borderRadius: "var(--r-lg, 6px)",
          background: "#fff",
          cursor: "pointer",
          font: "inherit",
          textAlign: "left",
        }}
      >
        <span
          style={{
            color: hasSel ? "var(--azul-profundo, #0D1F3C)" : "#8a8174",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {summary}
        </span>
        <span aria-hidden style={{ color: "#8a8174", flexShrink: 0 }}>▾</span>
      </button>
      {multiple && selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
          {selected.map((o) => (
            <span
              key={o.value}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 8px",
                background: "rgba(168,105,61,0.10)",
                color: "var(--terra, #A8693D)",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {o.label}
              <button
                type="button"
                onClick={() => pick(o.value)}
                style={{ border: "none", background: "none", color: "inherit", cursor: "pointer", padding: 0, fontSize: 14, lineHeight: 1 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {open && (
        <div
          style={{
            position: "absolute",
            zIndex: 30,
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "#fff",
            border: "1px solid var(--line, #DCD7CE)",
            borderRadius: "var(--r-lg, 6px)",
            boxShadow: "0 8px 24px rgba(13,31,60,0.12)",
            overflow: "hidden",
          }}
        >
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pesquisar…"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "8px 12px",
              border: "none",
              borderBottom: "1px solid var(--line, #DCD7CE)",
              font: "inherit",
              outline: "none",
            }}
          />
          <div style={{ maxHeight: 220, overflowY: "auto", padding: 4 }}>
            {!multiple && (
              <button
                type="button"
                onClick={() => {
                  onChange([]);
                  setOpen(false);
                  setQ("");
                }}
                style={{ width: "100%", textAlign: "left", padding: "7px 10px", border: "none", background: "none", cursor: "pointer", font: "inherit", color: "#8a8174", borderRadius: 4 }}
              >
                — Nenhum —
              </button>
            )}
            {filtered.map((o) => {
              const on = value.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => pick(o.value)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    textAlign: "left",
                    padding: "7px 10px",
                    border: "none",
                    background: on ? "rgba(168,105,61,0.08)" : "none",
                    cursor: "pointer",
                    font: "inherit",
                    color: "var(--azul-profundo, #0D1F3C)",
                    borderRadius: 4,
                  }}
                >
                  {multiple && <input type="checkbox" readOnly checked={on} style={{ pointerEvents: "none" }} />}
                  {o.label}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ padding: "8px 10px", color: "#8a8174", fontSize: 13 }}>
                {options.length === 0 ? emptyLabel : "Nada encontrado."}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
