"use client";

import { useEffect, useState } from "react";
import {
  LIBRARY_KINDS,
  LIBRARY_KIND_LABEL,
  type LibraryItemData,
  type LibraryKind,
} from "@crivo/types";
import {
  createLibraryItem,
  getMyPermissions,
  listLibrary,
  removeLibraryItem,
  updateLibraryItem,
} from "@/lib/api";

type LoadStatus = "loading" | "error" | "ok";
type Editing = LibraryItemData | "new" | null;

/** Academia CRIVO — acervo de conteúdo do tenant + CMS (gestão por library:manage). */
export function BibliotecaScreen() {
  const [data, setData] = useState<LibraryItemData[] | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [canManage, setCanManage] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);

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

      {status === "ok" && data && data.length === 0 && (
        <div className="card"><div className="card__head"><div>
          <h3>Acervo vazio</h3>
          <span className="card__sub">{canManage ? "Adicione o primeiro conteúdo." : "Nenhum material publicado ainda."}</span>
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
                {item.url && <a className="link-gold" href={item.url} target="_blank" rel="noreferrer">Acessar →</a>}
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
    </>
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
          <button className="icon-btn" onClick={onClose} title="Fechar">✕</button>
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
