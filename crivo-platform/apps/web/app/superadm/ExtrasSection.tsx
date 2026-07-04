"use client";

import { useEffect, useState } from "react";
import {
  MENTORIA_FORMAT_LABEL,
  MENTORIA_STATUS_LABEL,
  type ActionTemplateData,
  type EditableTextData,
  type GlobalAcademyContentData,
  type MentoriaData,
  type MentoriaFormat,
} from "@crivo/types";
import {
  createActionTemplate,
  createGlobalAcademy,
  createMentoria,
  listActionTemplates,
  listEditableTexts,
  listGlobalAcademy,
  listMentorias,
  upsertEditableText,
  updateGlobalAcademy,
} from "@/lib/admin-api";

type Tab = "mentorias" | "acoes" | "textos" | "academia";

/**
 * Super Admin · Extras CRIVO (#54):
 *  - Mentorias (Briefing §10)
 *  - Biblioteca de Ações modelo (Matriz §Plano de Ação)
 *  - Textos editáveis (copy do produto)
 *  - Academia CRIVO global
 *
 * UI mínima funcional: listar e criar. Edição avançada e fluxos de importação
 * para tenants ficam como próxima fatia.
 */
export function ExtrasSection() {
  const [tab, setTab] = useState<Tab>("mentorias");

  return (
    <div>
      <div className="route__head">
        <div>
          <h1 className="page-title">Recursos da Entrega</h1>
          <p className="page-sub">
            Sustentação da entrega vendida ao cliente — mentorias/encontros, biblioteca de ações
            modelo, textos editáveis e Academia CRIVO. Não é ferramenta interna: é o que o cliente
            recebe conforme o contrato (Gestão da Rotina, Liderança).
          </p>
        </div>
      </div>

      <div className="adm-callout">
        <strong>Catálogo global × liberação por cliente.</strong> O que se cadastra aqui é o
        <em> acervo global</em> (encontros modelo, ações, conteúdos da Academia). A liberação
        por <strong>contrato, solução, módulo, ciclo e público</strong> — com frequência, objetivo,
        registro/evidência, indicador e status por trilha — é aplicada na conta de cada cliente e
        entra como próxima fatia (hoje nada é liberado sem módulo habilitado).
      </div>

      <div className="adm-tabs">
        {([
          ["mentorias", "Mentorias"],
          ["acoes", "Biblioteca de Ações"],
          ["textos", "Textos editáveis"],
          ["academia", "Academia global"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`adm-tab${tab === key ? " is-active" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "mentorias" && <MentoriasTab />}
      {tab === "acoes" && <ActionTemplatesTab />}
      {tab === "textos" && <EditableTextsTab />}
      {tab === "academia" && <GlobalAcademyTab />}
    </div>
  );
}

// ── Mentorias ──────────────────────────────────────────────────────────

function MentoriasTab() {
  const [rows, setRows] = useState<MentoriaData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    tenantId: "", title: "", mentorName: "", attendee: "",
    format: "ONLINE" as MentoriaFormat,
    scheduledAt: "", durationMin: 60, meetingUrl: "", location: "",
  });
  const [busy, setBusy] = useState(false);

  async function load() {
    try { setRows(await listMentorias()); } catch (e) {
      setError(e instanceof Error ? e.message : "Falha");
    }
  }
  useEffect(() => { load(); }, []);

  async function submit() {
    setError(null);
    if (form.title.length < 3 || form.mentorName.length < 2 || form.attendee.length < 2) {
      setError("Preencha título, mentor e participante."); return;
    }
    if (!form.scheduledAt) { setError("Selecione uma data."); return; }
    if (!isUuid(form.tenantId)) { setError("tenantId precisa ser UUID."); return; }
    setBusy(true);
    try {
      await createMentoria({
        tenantId: form.tenantId,
        title: form.title.trim(),
        format: form.format,
        mentorName: form.mentorName.trim(),
        attendee: form.attendee.trim(),
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        durationMin: form.durationMin,
        meetingUrl: form.meetingUrl.trim() || undefined,
        location: form.location.trim() || undefined,
      });
      setShowNew(false);
      setForm({ tenantId: "", title: "", mentorName: "", attendee: "", format: "ONLINE", scheduledAt: "", durationMin: 60, meetingUrl: "", location: "" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao criar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex justify-between items-center">
        <p className="text-[13px] text-text-sec">Agenda de mentorias por cliente.</p>
        <button className="btn btn--terra btn--sm" onClick={() => setShowNew((s) => !s)}>
          {showNew ? "Cancelar" : "+ Nova mentoria"}
        </button>
      </div>

      {showNew && (
        <div className="mb-4 rounded-[4px] border border-line bg-[#fafaf7] p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-[11px] uppercase tracking-[0.1em] text-text-sec">
            tenantId (UUID)
            <input className="rounded-[3px] border border-line bg-white px-2 py-1.5 text-[13px] text-text font-mono" value={form.tenantId} onChange={(e) => setForm({...form, tenantId: e.target.value})} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] uppercase tracking-[0.1em] text-text-sec">
            Título
            <input className="rounded-[3px] border border-line bg-white px-2 py-1.5 text-[13px] text-text" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] uppercase tracking-[0.1em] text-text-sec">
            Mentor
            <input className="rounded-[3px] border border-line bg-white px-2 py-1.5 text-[13px] text-text" value={form.mentorName} onChange={(e) => setForm({...form, mentorName: e.target.value})} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] uppercase tracking-[0.1em] text-text-sec">
            Participante
            <input className="rounded-[3px] border border-line bg-white px-2 py-1.5 text-[13px] text-text" value={form.attendee} onChange={(e) => setForm({...form, attendee: e.target.value})} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] uppercase tracking-[0.1em] text-text-sec">
            Formato
            <select className="rounded-[3px] border border-line bg-white px-2 py-1.5 text-[13px] text-text" value={form.format} onChange={(e) => setForm({...form, format: e.target.value as MentoriaFormat})}>
              <option value="ONLINE">Online</option>
              <option value="PRESENCIAL">Presencial</option>
              <option value="HIBRIDA">Híbrida</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] uppercase tracking-[0.1em] text-text-sec">
            Data/hora
            <input type="datetime-local" className="rounded-[3px] border border-line bg-white px-2 py-1.5 text-[13px] text-text" value={form.scheduledAt} onChange={(e) => setForm({...form, scheduledAt: e.target.value})} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] uppercase tracking-[0.1em] text-text-sec">
            Duração (min)
            <input type="number" min={15} max={480} className="rounded-[3px] border border-line bg-white px-2 py-1.5 text-[13px] text-text" value={form.durationMin} onChange={(e) => setForm({...form, durationMin: parseInt(e.target.value) || 60})} />
          </label>
          {form.format !== "PRESENCIAL" && (
            <label className="flex flex-col gap-1 text-[11px] uppercase tracking-[0.1em] text-text-sec">
              URL da reunião
              <input className="rounded-[3px] border border-line bg-white px-2 py-1.5 text-[13px] text-text" value={form.meetingUrl} onChange={(e) => setForm({...form, meetingUrl: e.target.value})} />
            </label>
          )}
          {form.format !== "ONLINE" && (
            <label className="flex flex-col gap-1 text-[11px] uppercase tracking-[0.1em] text-text-sec">
              Local
              <input className="rounded-[3px] border border-line bg-white px-2 py-1.5 text-[13px] text-text" value={form.location} onChange={(e) => setForm({...form, location: e.target.value})} />
            </label>
          )}
          <div className="col-span-full flex justify-end gap-2">
            <button className="btn btn--terra btn--sm" onClick={submit} disabled={busy}>
              {busy ? "Salvando…" : "Criar mentoria"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="mb-3 rounded-[3px] border border-[#c2625b] bg-[#fdf5f4] p-2 text-[12px] text-[#9c4c46]">{error}</p>}
      {rows === null ? <p className="adm-empty">Carregando…</p> : rows.length === 0 ? (
        <p className="adm-empty">Nenhuma mentoria registrada.</p>
      ) : (
        <table className="data-table">
          <thead><tr><th>Título</th><th>Cliente</th><th>Mentor</th><th>Participante</th><th>Formato</th><th>Quando</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td>{m.title}</td>
                <td className="font-mono text-[11px]">{m.tenantId.slice(0,8)}…</td>
                <td>{m.mentorName}</td>
                <td>{m.attendee}</td>
                <td>{MENTORIA_FORMAT_LABEL[m.format]}</td>
                <td>{new Date(m.scheduledAt).toLocaleString("pt-BR")}</td>
                <td><span className="pattern-tag">{MENTORIA_STATUS_LABEL[m.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Action Templates ───────────────────────────────────────────────────

function ActionTemplatesTab() {
  const [rows, setRows] = useState<ActionTemplateData[] | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: "", category: "", description: "", suggestedResponsible: "", expectedEvidence: "", defaultReviewDays: 30 });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try { setRows(await listActionTemplates()); } catch (e) { setError(e instanceof Error ? e.message : "Falha"); }
  }
  useEffect(() => { load(); }, []);

  async function submit() {
    setError(null);
    if (form.title.length < 3 || form.category.length < 2) { setError("Título e categoria obrigatórios."); return; }
    setBusy(true);
    try {
      await createActionTemplate({
        title: form.title.trim(),
        category: form.category.trim(),
        description: form.description.trim() || undefined,
        suggestedResponsible: form.suggestedResponsible.trim() || undefined,
        expectedEvidence: form.expectedEvidence.trim() || undefined,
        defaultReviewDays: form.defaultReviewDays,
      });
      setShowNew(false);
      setForm({ title: "", category: "", description: "", suggestedResponsible: "", expectedEvidence: "", defaultReviewDays: 30 });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Falha"); } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="mb-3 flex justify-between items-center">
        <p className="text-[13px] text-text-sec">Catálogo global de ações modelo. O cliente importa para o próprio plano.</p>
        <button className="btn btn--terra btn--sm" onClick={() => setShowNew(s => !s)}>
          {showNew ? "Cancelar" : "+ Nova ação modelo"}
        </button>
      </div>

      {showNew && (
        <div className="mb-4 rounded-[4px] border border-line bg-[#fafaf7] p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-[11px] uppercase tracking-[0.1em] text-text-sec">
            Título
            <input className="rounded-[3px] border border-line bg-white px-2 py-1.5 text-[13px] text-text" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] uppercase tracking-[0.1em] text-text-sec">
            Categoria
            <input className="rounded-[3px] border border-line bg-white px-2 py-1.5 text-[13px] text-text" placeholder="Pessoas, Cultura, Operação…" value={form.category} onChange={(e) => setForm({...form, category: e.target.value})} />
          </label>
          <label className="col-span-full flex flex-col gap-1 text-[11px] uppercase tracking-[0.1em] text-text-sec">
            Descrição
            <textarea rows={2} className="rounded-[3px] border border-line bg-white px-2 py-1.5 text-[13px] text-text" value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] uppercase tracking-[0.1em] text-text-sec">
            Responsável-tipo
            <input className="rounded-[3px] border border-line bg-white px-2 py-1.5 text-[13px] text-text" placeholder="ex: RH, Liderança direta" value={form.suggestedResponsible} onChange={(e) => setForm({...form, suggestedResponsible: e.target.value})} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] uppercase tracking-[0.1em] text-text-sec">
            Evidência esperada
            <input className="rounded-[3px] border border-line bg-white px-2 py-1.5 text-[13px] text-text" placeholder="ex: Ata da reunião" value={form.expectedEvidence} onChange={(e) => setForm({...form, expectedEvidence: e.target.value})} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] uppercase tracking-[0.1em] text-text-sec">
            Revisão (dias)
            <input type="number" min={1} max={365} className="rounded-[3px] border border-line bg-white px-2 py-1.5 text-[13px] text-text" value={form.defaultReviewDays} onChange={(e) => setForm({...form, defaultReviewDays: parseInt(e.target.value) || 30})} />
          </label>
          <div className="col-span-full flex justify-end">
            <button className="btn btn--terra btn--sm" onClick={submit} disabled={busy}>
              {busy ? "Salvando…" : "Criar ação modelo"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="mb-3 rounded-[3px] border border-[#c2625b] bg-[#fdf5f4] p-2 text-[12px] text-[#9c4c46]">{error}</p>}
      {rows === null ? <p className="adm-empty">Carregando…</p> : rows.length === 0 ? (
        <p className="adm-empty">Nenhuma ação modelo cadastrada.</p>
      ) : (
        <table className="data-table">
          <thead><tr><th>Título</th><th>Categoria</th><th>Responsável</th><th>Evidência</th><th>Revisão</th><th>Ativa</th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>{a.title}</td>
                <td>{a.category}</td>
                <td>{a.suggestedResponsible ?? "—"}</td>
                <td>{a.expectedEvidence ?? "—"}</td>
                <td>{a.defaultReviewDays}d</td>
                <td>{a.active ? "✓" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Editable Texts ─────────────────────────────────────────────────────

function EditableTextsTab() {
  const [rows, setRows] = useState<EditableTextData[] | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newCategory, setNewCategory] = useState("geral");
  const [newContent, setNewContent] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try { setRows(await listEditableTexts()); } catch (e) { setError(e instanceof Error ? e.message : "Falha"); }
  }
  useEffect(() => { load(); }, []);

  async function saveEdit(key: string, category: string) {
    setError(null);
    try {
      await upsertEditableText({ key, content: draft, category });
      setEditingKey(null);
      setDraft("");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Falha"); }
  }

  async function createNew() {
    if (newKey.length < 2 || newContent.length === 0) { setError("Key e conteúdo são obrigatórios."); return; }
    try {
      await upsertEditableText({ key: newKey, category: newCategory, content: newContent });
      setShowNew(false); setNewKey(""); setNewContent("");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Falha"); }
  }

  return (
    <div>
      <div className="mb-3 flex justify-between items-center">
        <p className="text-[13px] text-text-sec">Copy do produto editável sem deploy. Versionado automaticamente.</p>
        <button className="btn btn--terra btn--sm" onClick={() => setShowNew(s => !s)}>
          {showNew ? "Cancelar" : "+ Nova chave"}
        </button>
      </div>

      {showNew && (
        <div className="mb-4 rounded-[4px] border border-line bg-[#fafaf7] p-4 flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-[11px] uppercase tracking-[0.1em] text-text-sec">
              Key
              <input className="rounded-[3px] border border-line bg-white px-2 py-1.5 text-[13px] font-mono text-text" placeholder="EMAIL_WELCOME_BODY" value={newKey} onChange={(e) => setNewKey(e.target.value.toUpperCase())} />
            </label>
            <label className="flex flex-col gap-1 text-[11px] uppercase tracking-[0.1em] text-text-sec">
              Categoria
              <input className="rounded-[3px] border border-line bg-white px-2 py-1.5 text-[13px] text-text" placeholder="emails, legais, onboarding…" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-[11px] uppercase tracking-[0.1em] text-text-sec">
            Conteúdo (markdown)
            <textarea rows={6} className="rounded-[3px] border border-line bg-white px-2 py-1.5 text-[13px] text-text font-body" value={newContent} onChange={(e) => setNewContent(e.target.value)} />
          </label>
          <div className="flex justify-end">
            <button className="btn btn--terra btn--sm" onClick={createNew}>Criar</button>
          </div>
        </div>
      )}

      {error && <p className="mb-3 rounded-[3px] border border-[#c2625b] bg-[#fdf5f4] p-2 text-[12px] text-[#9c4c46]">{error}</p>}
      {rows === null ? <p className="adm-empty">Carregando…</p> : rows.length === 0 ? (
        <p className="adm-empty">Nenhum texto cadastrado.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((t) => (
            <div key={t.id} className="rounded-[4px] border border-line bg-white p-3">
              <div className="flex justify-between items-start gap-2 mb-2">
                <div>
                  <strong className="font-mono text-[13px] text-azul-profundo">{t.key}</strong>
                  <span className="ml-2 text-[11px] text-text-sec">{t.category} · v{t.version} {t.updatedBy ? `· ${t.updatedBy}` : ""}</span>
                </div>
                {editingKey === t.key ? (
                  <div className="flex gap-2">
                    <button className="btn btn--terra btn--sm" onClick={() => saveEdit(t.key, t.category)}>Salvar</button>
                    <button className="rounded-[3px] border border-line bg-white px-3 py-1 text-[11px] text-text-sec" onClick={() => setEditingKey(null)}>Cancelar</button>
                  </div>
                ) : (
                  <button className="text-[11px] text-azul-cobalto hover:underline" onClick={() => { setEditingKey(t.key); setDraft(t.content); }}>editar</button>
                )}
              </div>
              {editingKey === t.key ? (
                <textarea rows={5} className="w-full rounded-[3px] border border-line bg-white px-2 py-1.5 text-[12px] text-text font-body" value={draft} onChange={(e) => setDraft(e.target.value)} />
              ) : (
                <pre className="whitespace-pre-wrap text-[12px] text-text leading-[1.55] font-body bg-[#fafaf7] p-2 rounded-[3px] max-h-[140px] overflow-auto">{t.content}</pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Global Academy ─────────────────────────────────────────────────────

function GlobalAcademyTab() {
  const [rows, setRows] = useState<GlobalAcademyContentData[] | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: "", kind: "curso", description: "", url: "", category: "", published: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try { setRows(await listGlobalAcademy()); } catch (e) { setError(e instanceof Error ? e.message : "Falha"); }
  }
  useEffect(() => { load(); }, []);

  async function submit() {
    setError(null);
    if (form.title.length < 3) { setError("Título obrigatório."); return; }
    setBusy(true);
    try {
      await createGlobalAcademy({
        title: form.title.trim(),
        kind: form.kind,
        description: form.description.trim() || undefined,
        url: form.url.trim() || undefined,
        category: form.category.trim() || undefined,
        published: form.published,
      });
      setShowNew(false);
      setForm({ title: "", kind: "curso", description: "", url: "", category: "", published: false });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Falha"); } finally { setBusy(false); }
  }

  async function togglePublish(item: GlobalAcademyContentData) {
    try {
      await updateGlobalAcademy(item.id, {
        title: item.title, kind: item.kind,
        description: item.description ?? undefined,
        url: item.url ?? undefined,
        category: item.category ?? undefined,
        tags: item.tags,
        published: !item.published,
      });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Falha"); }
  }

  return (
    <div>
      <div className="mb-3 flex justify-between items-center">
        <p className="text-[13px] text-text-sec">Catálogo global da Academia CRIVO. Curado pelo Super Admin.</p>
        <button className="btn btn--terra btn--sm" onClick={() => setShowNew(s => !s)}>
          {showNew ? "Cancelar" : "+ Novo conteúdo"}
        </button>
      </div>

      {showNew && (
        <div className="mb-4 rounded-[4px] border border-line bg-[#fafaf7] p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-[11px] uppercase tracking-[0.1em] text-text-sec">
            Título
            <input className="rounded-[3px] border border-line bg-white px-2 py-1.5 text-[13px] text-text" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] uppercase tracking-[0.1em] text-text-sec">
            Tipo
            <select className="rounded-[3px] border border-line bg-white px-2 py-1.5 text-[13px] text-text" value={form.kind} onChange={(e) => setForm({...form, kind: e.target.value})}>
              <option value="curso">Curso</option>
              <option value="video">Vídeo</option>
              <option value="trilha">Trilha</option>
              <option value="ebook">E-book</option>
              <option value="artigo">Artigo</option>
              <option value="podcast">Podcast</option>
            </select>
          </label>
          <label className="col-span-full flex flex-col gap-1 text-[11px] uppercase tracking-[0.1em] text-text-sec">
            Descrição
            <textarea rows={2} className="rounded-[3px] border border-line bg-white px-2 py-1.5 text-[13px] text-text" value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] uppercase tracking-[0.1em] text-text-sec">
            URL
            <input className="rounded-[3px] border border-line bg-white px-2 py-1.5 text-[13px] text-text" value={form.url} onChange={(e) => setForm({...form, url: e.target.value})} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] uppercase tracking-[0.1em] text-text-sec">
            Categoria
            <input className="rounded-[3px] border border-line bg-white px-2 py-1.5 text-[13px] text-text" placeholder="Liderança, Cultura…" value={form.category} onChange={(e) => setForm({...form, category: e.target.value})} />
          </label>
          <label className="col-span-full flex items-center gap-2 text-[13px] text-text">
            <input type="checkbox" checked={form.published} onChange={(e) => setForm({...form, published: e.target.checked})} />
            <span>Publicado (visível aos clientes)</span>
          </label>
          <div className="col-span-full flex justify-end">
            <button className="btn btn--terra btn--sm" onClick={submit} disabled={busy}>
              {busy ? "Salvando…" : "Criar conteúdo"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="mb-3 rounded-[3px] border border-[#c2625b] bg-[#fdf5f4] p-2 text-[12px] text-[#9c4c46]">{error}</p>}
      {rows === null ? <p className="adm-empty">Carregando…</p> : rows.length === 0 ? (
        <p className="adm-empty">Nenhum conteúdo cadastrado.</p>
      ) : (
        <table className="data-table">
          <thead><tr><th>Título</th><th>Tipo</th><th>Categoria</th><th>URL</th><th>Publicado</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>{c.title}</td>
                <td>{c.kind}</td>
                <td>{c.category ?? "—"}</td>
                <td>{c.url ? <a className="text-azul-cobalto hover:underline" href={c.url} target="_blank" rel="noopener">link</a> : "—"}</td>
                <td>
                  <button className="text-[11px] text-azul-cobalto hover:underline" onClick={() => togglePublish(c)}>
                    {c.published ? "✓ publicado" : "— rascunho"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
