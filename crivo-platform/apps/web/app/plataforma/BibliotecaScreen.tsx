"use client";

import { useEffect, useState } from "react";
import { IconCheck, IconChevronDown, IconChevronRight, IconClose, IconExternal } from "./Icons";
import {
  LIBRARY_KINDS,
  LIBRARY_KIND_LABEL,
  type LibraryItemData,
  type LibraryKind,
} from "@crivo/types";
import {
  createLibraryItem,
  getMyGlobalAcademy,
  getMyPermissions,
  importGlobalAcademyToLibrary,
  listLibrary,
  removeLibraryItem,
  updateLibraryItem,
  type GlobalAcademyLite,
} from "@/lib/api";

type LoadStatus = "loading" | "error" | "ok";
type Editing = LibraryItemData | "new" | null;

/** Academia CRIVO — acervo de conteúdo do tenant + CMS (gestão por library:manage). */
export function BibliotecaScreen() {
  const [data, setData] = useState<LibraryItemData[] | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [canManage, setCanManage] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [preview, setPreview] = useState<PreviewItem | null>(null);

  async function load() {
    setStatus("loading");
    try {
      const [items, perms] = await Promise.all([listLibrary(), getMyPermissions().catch(() => [] as string[])]);
      setData(items);
      setCanManage(perms.includes("library:manage"));
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }
  useEffect(() => { void load(); }, []);

  async function del(item: LibraryItemData) {
    if (!confirm(`Remover "${item.title}" da Academia?`)) return;
    try { await removeLibraryItem(item.id); await load(); }
    catch (e) { alert(e instanceof Error ? e.message : "Falha ao remover"); }
  }

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Academia CRIVO</h1>
          <p className="page-sub">Cursos, trilhas, vídeos, mentorias, guias e materiais de liderança e cultura.</p>
        </div>
        <div className="route__actions">
          {canManage && (
            <button className="btn btn--terra btn--sm" onClick={() => setEditing("new")}>Adicionar conteúdo</button>
          )}
          <button className="btn btn--outline-dark btn--sm" onClick={load} disabled={status === "loading"}>
            {status === "loading" ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>

      {status === "loading" && <p className="dash-state">Carregando Academia…</p>}
      {status === "error" && (
        <div className="dash-state dash-state--error">
          Não foi possível carregar. <button className="btn btn--outline-dark btn--sm" onClick={load}>Tentar novamente</button>
        </div>
      )}

      {/* #62 — Catálogo global CRIVO (visível a quem pode gerenciar). */}
      {status === "ok" && canManage && <GlobalCatalogPanel onImported={load} onPreview={setPreview} existingUrls={new Set((data ?? []).map(d => d.url).filter(Boolean) as string[])} />}

      {status === "ok" && data && data.length === 0 && (
        <div className="card"><div className="card__head"><div>
          <h3>Acervo vazio</h3>
          <span className="card__sub">{canManage ? "Adicione um conteúdo próprio ou importe do catálogo CRIVO." : "Nenhum material publicado ainda."}</span>
        </div></div></div>
      )}

      {status === "ok" && data && data.length > 0 && (
        <div className="grid grid--3">
          {data.map((item) => (
            <div key={item.id} className="card card--mini">
              <span className="card__eyebrow">{LIBRARY_KIND_LABEL[item.kind] ?? item.kind}</span>
              <h4>{item.title}</h4>
              {item.description && <p>{item.description}</p>}
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 6 }}>
                <button className="link-gold" onClick={() => setPreview(item)}>Acessar →</button>
                {canManage && (
                  <>
                    <button className="lib-act" onClick={() => setEditing(item)}>Editar</button>
                    <button className="lib-act lib-act--danger" onClick={() => del(item)}>Excluir</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <LibraryForm
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await load(); }}
        />
      )}

      {preview && <ContentPreviewModal item={preview} onClose={() => setPreview(null)} />}
    </>
  );
}

/** Forma mínima de um conteúdo para a prévia (serve para LibraryItem e catálogo global). */
type PreviewItem = { title: string; kind: string; description?: string | null; url?: string | null; category?: string | null };

/** Prévia do conteúdo da Academia. Sempre abre algo ao clicar "Acessar" —
 *  evita link externo morto. Se houver URL válida, oferece abrir em nova aba. */
function ContentPreviewModal({ item, onClose }: { item: PreviewItem; onClose: () => void }) {
  const label = LIBRARY_KIND_LABEL[item.kind as LibraryKind] ?? item.kind;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <div>
            <span className="card__eyebrow">{label}{item.category ? ` · ${item.category}` : ""}</span>
            <h2 style={{ marginTop: 4 }}>{item.title}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} title="Fechar"><IconClose size={16} /></button>
        </header>
        <div className="modal__body">
          <p style={{ color: "var(--text-sec)", lineHeight: 1.6 }}>
            {item.description || "Conteúdo do acervo CRIVO. A versão completa fica disponível no link do material."}
          </p>
        </div>
        <div className="modal__foot">
          <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>Fechar</button>
          {item.url ? (
            <a
              className="btn btn--terra btn--sm"
              href={item.url}
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: "none" }}
            >
              Abrir conteúdo <IconExternal size={14} />
            </a>
          ) : (
            <span className="card__sub" style={{ alignSelf: "center" }}>Link em breve</span>
          )}
        </div>
      </div>
    </div>
  );
}

function LibraryForm({ initial, onClose, onSaved }: { initial: LibraryItemData | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [kind, setKind] = useState<LibraryKind>(initial?.kind ?? "curso");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { title: title.trim(), kind, description: description || undefined, url: url || undefined };
      if (initial) await updateLibraryItem(initial.id, payload);
      else await createLibraryItem(payload);
      onSaved();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Falha ao salvar (verifique se o link é uma URL válida).");
    } finally { setSaving(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <h2>{initial ? "Editar conteúdo" : "Novo conteúdo"}</h2>
          <button className="icon-btn" onClick={onClose} title="Fechar"><IconClose size={16} /></button>
        </header>
        <form onSubmit={submit} className="modal__body prod-form">
          <div className="prod-form__grid">
            <label className="prod-field prod-field--full"><span>Título</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </label>
            <label className="prod-field"><span>Tipo</span>
              <select value={kind} onChange={(e) => setKind(e.target.value as LibraryKind)}>
                {LIBRARY_KINDS.map((k) => (<option key={k} value={k}>{LIBRARY_KIND_LABEL[k]}</option>))}
              </select>
            </label>
            <label className="prod-field"><span>Link (YouTube/LinkedIn/PDF/URL)</span>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
            </label>
            <label className="prod-field prod-field--full"><span>Descrição</span>
              <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
          </div>
          <div className="modal__foot">
            <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn--terra btn--sm" disabled={saving || !title.trim()}>
              {saving ? "Salvando…" : initial ? "Salvar" : "Adicionar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── #62 — Catálogo global Academia CRIVO (Super Admin) ────────────────

function GlobalCatalogPanel({ onImported, onPreview, existingUrls }: { onImported: () => void; onPreview: (i: PreviewItem) => void; existingUrls: Set<string> }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<GlobalAcademyLite[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || items) return;
    getMyGlobalAcademy().then(setItems).catch(() => setItems([]));
  }, [open, items]);

  async function imp(id: string) {
    setBusyId(id);
    try {
      await importGlobalAcademyToLibrary(id);
      onImported();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Falha ao importar.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16, padding: 14 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center",
          padding: 6, background: "none", border: 0, cursor: "pointer", color: "var(--text)",
          fontFamily: "var(--font-display)", fontSize: 15,
        }}
      >
        <span>
          {open ? <IconChevronDown size={13} /> : <IconChevronRight size={13} />} Catálogo CRIVO {items && `(${items.length} item${items.length === 1 ? "" : "s"})`}
        </span>
        <span className="card__sub" style={{ fontSize: 12 }}>curado pelo time CRIVO</span>
      </button>
      {open && (
        <div style={{ marginTop: 12 }}>
          {items === null && <p className="card__sub">Carregando…</p>}
          {items && items.length === 0 && <p className="card__sub">Nenhum conteúdo publicado pelo Super Admin ainda.</p>}
          {items && items.length > 0 && (
            <div className="grid grid--3">
              {items.map((it) => {
                const already = it.url ? existingUrls.has(it.url) : false;
                return (
                  <div key={it.id} className="card card--mini">
                    <span className="card__eyebrow">{it.kind}{it.category && ` · ${it.category}`}</span>
                    <h4>{it.title}</h4>
                    {it.description && <p>{it.description}</p>}
                    <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
                      <button className="link-gold" onClick={() => onPreview(it)}>Acessar →</button>
                      {already ? (
                        <span className="card__sub" style={{ fontSize: 11 }}><IconCheck size={12} /> já está na sua biblioteca</span>
                      ) : (
                        <button
                          className="btn btn--gold btn--sm"
                          onClick={() => imp(it.id)}
                          disabled={busyId === it.id}
                        >
                          {busyId === it.id ? "Importando…" : "+ Adicionar à minha biblioteca"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
