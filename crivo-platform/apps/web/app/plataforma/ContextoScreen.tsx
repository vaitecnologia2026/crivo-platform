"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  MODULES,
  TENANT_DIRECTIVE_STATUS_LABEL,
  TENANT_DOCUMENT_FILE_EXTENSIONS,
  TENANT_DOCUMENT_STATUSES,
  TENANT_DOCUMENT_STATUS_LABEL,
  type CreateTenantDocumentRequest,
  type TenantAiUseCaseContextData,
  type TenantAiUseCasesResponse,
  type TenantContextAuditEntry,
  type TenantContextOverview,
  type TenantDirectiveData,
  type TenantDirectiveStatus,
  type TenantDocumentData,
  type TenantDocumentStatus,
  type TenantTermData,
} from "@crivo/types";
import {
  ApiError,
  changeContextDirectiveStatus,
  changeContextDocumentStatus,
  createContextDirective,
  createContextDocument,
  createContextTerm,
  deleteContextTerm,
  downloadContextDocumentFile,
  getContextOverview,
  getMyPermissions,
  listContextAiUseCases,
  listContextAudit,
  listContextDirectives,
  listContextDocuments,
  listContextTerms,
  replaceContextDocument,
  revokeContextDocument,
  updateContextAiUseCase,
  updateContextDirective,
  updateContextTerm,
} from "@/lib/api";
import { exportPDF, exportXLSX, useExportContext, type ExportSection, type ExportSheet } from "@/lib/exports";
import { IconClose } from "./Icons";

/**
 * Programas › Contexto e Diretrizes (rota `contexto`) — layout do protótipo
 * Lovable (5 abas: Diretrizes Institucionais · Documentos Autorizados ·
 * Terminologia e Regras · Casos de Uso da IA · Histórico e Auditoria), com
 * dados REAIS do módulo /context/* (TenantDirective, TenantDocument,
 * TenantTerm, TenantAiUseCaseContext — data plane da empresa). Nenhuma
 * diretriz/documento/termo/evento demo.
 *
 * O que o protótipo só encenava vira regra aqui: diretriz TEM status e versão;
 * documento tem ciclo de vida fechado (Rascunho → Em revisão → Aprovado/
 * Publicado → Substituído | Revogado) com justificativa ao revogar e nova
 * versão real ao substituir; o toggle por caso de uso é persistido e só liga
 * com o adicional premium (IA Contextualizada). Só o APROVADO alimenta a IA.
 * Escrita só com a permissão context:manage (lida de /me/permissions).
 */

type Tab = "diretrizes" | "docs" | "termos" | "casos" | "hist";
const TABS: Array<[Tab, string]> = [
  ["diretrizes", "Diretrizes Institucionais"],
  ["docs", "Documentos Autorizados"],
  ["termos", "Terminologia e Regras"],
  ["casos", "Casos de Uso da IA"],
  ["hist", "Histórico e Auditoria"],
];

type LoadStatus = "loading" | "error" | "ok";
const moduloDesligado = (err: unknown) => err instanceof ApiError && err.status === 403;

/** Carrega um recurso; `data` null + status ok = módulo não liberado (403 do ModuleGuard). */
function useRecurso<T>(loader: () => Promise<T>, tick: number): { data: T | null; status: LoadStatus; erro: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    loader()
      .then((d) => { if (alive) { setData(d); setStatus("ok"); setErro(null); } })
      .catch((err) => {
        if (!alive) return;
        if (moduloDesligado(err)) { setData(null); setStatus("ok"); return; }
        setErro(err instanceof Error ? err.message : "Falha ao carregar.");
        setStatus("error");
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
  return { data, status, erro };
}

// ── Ícones SVG de traço (regra do cliente: nunca emoji) ──
const Svg = ({ children, size = 14 }: { children: ReactNode; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: "-0.15em", flexShrink: 0 }}>
    {children}
  </svg>
);
const IconDownload = () => (<Svg><path d="M12 4v11" /><path d="M7 10l5 5 5-5" /><path d="M4 20h16" /></Svg>);
const IconFile = () => (<Svg><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h6" /></Svg>);
const IconPlus = () => (<Svg><path d="M12 5v14" /><path d="M5 12h14" /></Svg>);
const IconEye = () => (<Svg><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Svg>);
const IconRefresh = () => (<Svg><path d="M20 12a8 8 0 1 1-2.3-5.7" /><path d="M20 4v5h-5" /></Svg>);
const IconBook = () => (<Svg size={24}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5" /><path d="M8 7h7M8 11h7" /></Svg>);
const IconShield = () => (<Svg><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z" /><path d="M9 12l2 2 4-4" /></Svg>);

const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");
const fmtDateTime = (d: string | null | undefined) => (d ? new Date(d).toLocaleString("pt-BR") : "—");
const MODULE_NAME = new Map<string, string>(MODULES.map((m) => [m.code, m.name]));
const moduleNames = (codes: string[]) => (codes.length ? codes.map((c) => MODULE_NAME.get(c) ?? c).join(", ") : "—");

function docPill(s: TenantDocumentStatus): string {
  if (s === "APROVADO_PUBLICADO") return "pill pill--gold";
  if (s === "REVOGADO") return "pill pill--danger";
  return "pill";
}
function dirPill(s: TenantDirectiveStatus): string {
  if (s === "APROVADA") return "pill pill--gold";
  if (s === "REVOGADA") return "pill pill--danger";
  return "pill";
}
const erroDe = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

export function ContextoScreen() {
  const [tab, setTab] = useState<Tab>("diretrizes");
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  const [canManage, setCanManage] = useState(false);
  const exportCtx = useExportContext();
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);

  const overview = useRecurso<TenantContextOverview>(getContextOverview, tick);
  const diretrizes = useRecurso<TenantDirectiveData[]>(listContextDirectives, tick);
  const documentos = useRecurso<TenantDocumentData[]>(() => listContextDocuments(), tick);
  const termos = useRecurso<TenantTermData[]>(listContextTerms, tick);
  const casos = useRecurso<TenantAiUseCasesResponse>(listContextAiUseCases, tick);
  const auditoria = useRecurso<TenantContextAuditEntry[]>(listContextAudit, tick);

  useEffect(() => {
    let alive = true;
    getMyPermissions()
      .then((perms) => { if (alive) setCanManage(perms.includes("context:manage")); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const semModulo = overview.status === "ok" && !overview.data;
  const loading = [overview, diretrizes, documentos, termos, casos, auditoria].some((r) => r.status === "loading");
  const customAiAllowed = overview.data?.customAiAllowed ?? false;

  // ── Exportação (helper compartilhado). Só o que está na tela. ──
  function buildSheets(): ExportSheet[] {
    return [
      { name: "Diretrizes", rows: (diretrizes.data ?? []).map((d) => ({ Título: d.title, Texto: d.text, Status: TENANT_DIRECTIVE_STATUS_LABEL[d.status], Versão: `v${d.version}`, Aprovador: d.approvedByName ?? "—", "Aprovada em": fmtDate(d.approvedAt) })) },
      { name: "Documentos", rows: (documentos.data ?? []).map((d) => ({ ID: d.code, Título: d.title, Tipo: d.kind, Versão: d.version, Data: fmtDate(d.issuedAt), Responsável: d.owner, Módulos: moduleNames(d.modules), "Nível de acesso": d.accessLevel, Status: TENANT_DOCUMENT_STATUS_LABEL[d.status] })) },
      { name: "Terminologia", rows: (termos.data ?? []).map((t) => ({ Termo: t.term, Definição: t.definition, Contexto: t.context })) },
      { name: "Casos de uso da IA", rows: (casos.data?.items ?? []).map((c) => ({ Caso: c.label, Documentos: c.documentCodes.join(", ") || "—", Ativo: c.active ? "Sim" : "Não" })) },
    ];
  }
  async function handleExport(kind: "xlsx" | "pdf") {
    if (!exportCtx) return;
    setExporting(kind);
    try {
      const sheets = buildSheets();
      if (kind === "xlsx") await exportXLSX("crivo-contexto-empresa", sheets, exportCtx);
      else await exportPDF("crivo-contexto-empresa", "Contexto e Diretrizes", sheets.slice(0, 2).map((s): ExportSection => ({ heading: s.name, rows: s.rows })), exportCtx);
    } finally {
      setExporting(null);
    }
  }

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Contexto e Diretrizes</h1>
          <p className="page-sub">Workspace da IA Contextualizada do Cliente. Base segregada por CNPJ, contrato, módulo e finalidade — sem uso cruzado entre clientes.</p>
        </div>
        <div className="route__actions" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn btn--outline-dark btn--sm" onClick={() => handleExport("xlsx")} disabled={!exportCtx || !!exporting || loading || semModulo} title={!exportCtx ? "Carregando identificação da empresa…" : "Exportar diretrizes, documentos, terminologia e casos de uso em Excel"}>
            <IconDownload /> {exporting === "xlsx" ? "Gerando…" : "XLSX"}
          </button>
          <button className="btn btn--outline-dark btn--sm" onClick={() => handleExport("pdf")} disabled={!exportCtx || !!exporting || loading || semModulo} title={!exportCtx ? "Carregando identificação da empresa…" : "Exportar diretrizes e documentos em PDF"}>
            <IconFile /> {exporting === "pdf" ? "Gerando…" : "PDF"}
          </button>
          <button className="btn btn--outline-dark btn--sm" onClick={reload} disabled={loading} title="Recarregar">
            <IconRefresh /> {loading ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>

      {overview.status === "error" && (
        <div className="dash-state dash-state--error">
          Não foi possível carregar o Contexto e Diretrizes. {overview.erro}{" "}
          <button className="btn btn--outline-dark btn--sm" onClick={reload}>Tentar novamente</button>
        </div>
      )}

      {semModulo && (
        <div className="dash-state">
          O módulo Contexto e Diretrizes não está ativo para a sua empresa. Diretrizes, documentos autorizados, terminologia e os casos de uso da IA aparecem aqui quando o módulo for liberado no contrato.
        </div>
      )}

      {!semModulo && overview.status !== "error" && (
        <>
          <div className="card card--pattern" style={{ marginBottom: 16 }}>
            <div className="card__head"><div><h3><IconShield /> IA Contextualizada</h3><span className="card__sub">Adicional premium do Motor de IA — não cria novo motor nem exige treinar modelo exclusivo.</span></div></div>
            <p style={{ fontSize: 13, color: "var(--text-sec)", lineHeight: 1.6, margin: 0 }}>
              Ordem de precedência: segurança CRIVO → prompt/caso global → metodologia → contrato → diretrizes aprovadas → documentos autorizados → dados permitidos → instrução do usuário.
              Apenas diretrizes <strong>Aprovadas</strong> e documentos <strong>Aprovado/Publicado</strong> vinculados a um caso de uso com <strong>uso contextual ativo</strong> alimentam a IA — rascunhos nunca.
            </p>
            {overview.data && !customAiAllowed && (
              <p className="card__hint" style={{ marginTop: 8 }}>
                O produto contratado pela sua empresa não inclui a IA Contextualizada. Você pode preparar diretrizes, documentos e terminologia normalmente; o toggle “uso contextual ativo” fica desligado até a contratação do adicional.
              </p>
            )}
          </div>

          <div className="seg" style={{ flexWrap: "wrap", marginBottom: 16 }}>
            {TABS.map(([key, label]) => (
              <button key={key} type="button" className={`seg__btn${tab === key ? " is-active" : ""}`} onClick={() => setTab(key)}>{label}</button>
            ))}
          </div>

          {tab === "diretrizes" && <DiretrizesTab diretrizes={diretrizes} canManage={canManage} onChanged={reload} />}
          {tab === "docs" && <DocumentosTab documentos={documentos} overview={overview.data} canManage={canManage} onChanged={reload} />}
          {tab === "termos" && <TermosTab termos={termos} canManage={canManage} onChanged={reload} />}
          {tab === "casos" && <CasosTab casos={casos} documentos={documentos.data ?? []} canManage={canManage} onChanged={reload} />}
          {tab === "hist" && <HistoricoTab auditoria={auditoria} />}
        </>
      )}
    </>
  );
}

// ── Modais utilitários ─────────────────────────────────────────────────────

/** Ação que exige justificativa (revogar diretriz/documento). */
function JustificativaModal({ titulo, descricao, confirmar, onClose, onConfirm }: {
  titulo: string; descricao: string; confirmar: string; onClose: () => void; onConfirm: (justification: string) => Promise<void>;
}) {
  const [texto, setTexto] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!texto.trim()) { setErro("A justificativa é obrigatória."); return; }
    setBusy(true);
    setErro(null);
    try { await onConfirm(texto.trim()); } catch (err) { setErro(erroDe(err, "Falha ao registrar.")); setBusy(false); }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="modal__head"><h2>{titulo}</h2><button type="button" className="icon-btn" onClick={onClose} title="Fechar"><IconClose size={16} /></button></header>
        <div className="modal__body prod-form">
          <p className="card__hint" style={{ margin: 0 }}>{descricao}</p>
          <label className="prod-field prod-field--full"><span>Justificativa</span><textarea rows={3} required value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Fica registrada na auditoria da empresa" /></label>
          {erro && <div className="dash-state dash-state--error" style={{ margin: 0 }}>{erro}</div>}
        </div>
        <div className="modal__foot">
          <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn--gold btn--sm" disabled={busy}>{busy ? "Registrando…" : confirmar}</button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="card__hint" style={{ textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600, fontSize: 10 }}>{label}</div>
      <div style={{ fontSize: 14 }}>{value}</div>
    </div>
  );
}

// ── Aba Diretrizes Institucionais ──────────────────────────────────────────

function DiretrizesTab({ diretrizes, canManage, onChanged }: { diretrizes: ReturnType<typeof useRecurso<TenantDirectiveData[]>>; canManage: boolean; onChanged: () => void }) {
  const [form, setForm] = useState<{ open: boolean; initial: TenantDirectiveData | null }>({ open: false, initial: null });
  const [revogando, setRevogando] = useState<TenantDirectiveData | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const lista = diretrizes.data ?? [];

  async function mudar(d: TenantDirectiveData, status: TenantDirectiveStatus) {
    setBusyId(d.id);
    setErro(null);
    try { await changeContextDirectiveStatus(d.id, { status }); onChanged(); } catch (e) { setErro(erroDe(e, "Falha ao mudar o status.")); } finally { setBusyId(null); }
  }

  if (diretrizes.status === "loading") return <p className="dash-state">Carregando diretrizes…</p>;
  if (diretrizes.status === "error") return <div className="dash-state dash-state--error">Não foi possível carregar as diretrizes. {diretrizes.erro}</div>;

  return (
    <>
      {lista.length === 0 ? (
        <div className="dash-empty">
          <div className="dash-empty__ic"><IconBook /></div>
          <h3 className="dash-empty__title">Nenhuma diretriz cadastrada</h3>
          <p className="dash-empty__sub">Missão, valores, prioridades e compromissos regulatórios da sua empresa. Uma diretriz nasce como Rascunho, passa por revisão e só depois de <strong>Aprovada</strong> passa a orientar a IA.</p>
          {canManage ? <button className="btn btn--gold btn--sm" onClick={() => setForm({ open: true, initial: null })}><IconPlus /> Nova diretriz</button> : <span className="card__hint">Cadastro disponível para quem tem a permissão “Gerir Contexto e Diretrizes”.</span>}
        </div>
      ) : (
        <>
          {canManage && (
            <div style={{ marginBottom: 14 }}>
              <button className="btn btn--gold btn--sm" onClick={() => setForm({ open: true, initial: null })}><IconPlus /> Nova diretriz</button>
            </div>
          )}
          {erro && <div className="dash-state dash-state--error" style={{ marginBottom: 12 }}>{erro}</div>}
          <div className="grid grid--2">
            {lista.map((d) => (
              <div key={d.id} className="card" style={{ marginBottom: 0 }}>
                <div className="card__head" style={{ alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <span className="card__hint">Diretriz · v{d.version}{d.approvedAt ? ` · aprovada em ${fmtDate(d.approvedAt)} por ${d.approvedByName ?? "—"}` : ""}</span>
                    <h3 style={{ marginTop: 2 }}>{d.title}</h3>
                  </div>
                  <span className={dirPill(d.status)} style={{ flexShrink: 0 }}>{TENANT_DIRECTIVE_STATUS_LABEL[d.status]}</span>
                </div>
                <p style={{ fontSize: 14, color: "var(--text-sec)", lineHeight: 1.6, margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{d.text}</p>
                {d.status === "REVOGADA" && d.revokeJustification && <p className="card__hint" style={{ marginTop: 6 }}>Motivo da revogação: {d.revokeJustification}</p>}
                {canManage && d.status !== "REVOGADA" && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                    <button className="btn btn--outline-dark btn--sm" disabled={busyId === d.id} onClick={() => setForm({ open: true, initial: d })} title={d.status === "APROVADA" ? "Editar uma diretriz aprovada a devolve a Rascunho (nova versão)" : "Editar"}>Editar</button>
                    {d.status === "RASCUNHO" && <button className="btn btn--outline-dark btn--sm" disabled={busyId === d.id} onClick={() => mudar(d, "EM_REVISAO")}>Enviar para revisão</button>}
                    {d.status === "EM_REVISAO" && <button className="btn btn--gold btn--sm" disabled={busyId === d.id} onClick={() => mudar(d, "APROVADA")}>Aprovar</button>}
                    {d.status === "EM_REVISAO" && <button className="btn btn--outline-dark btn--sm" disabled={busyId === d.id} onClick={() => mudar(d, "RASCUNHO")}>Devolver a rascunho</button>}
                    <button className="btn btn--ghost btn--sm" disabled={busyId === d.id} onClick={() => setRevogando(d)}>Revogar</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {form.open && <DiretrizForm initial={form.initial} onClose={() => setForm({ open: false, initial: null })} onSaved={() => { setForm({ open: false, initial: null }); onChanged(); }} />}
      {revogando && (
        <JustificativaModal
          titulo={`Revogar “${revogando.title}”`}
          descricao="A diretriz deixa de orientar a IA imediatamente. Revogar é definitivo — para voltar, cadastre uma nova diretriz."
          confirmar="Revogar diretriz"
          onClose={() => setRevogando(null)}
          onConfirm={async (justification) => { await changeContextDirectiveStatus(revogando.id, { status: "REVOGADA", justification }); setRevogando(null); onChanged(); }}
        />
      )}
    </>
  );
}

function DiretrizForm({ initial, onClose, onSaved }: { initial: TenantDirectiveData | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [text, setText] = useState(initial?.text ?? "");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErro(null);
    try {
      if (initial) await updateContextDirective(initial.id, { title: title.trim(), text: text.trim() });
      else await createContextDirective({ title: title.trim(), text: text.trim() });
      onSaved();
    } catch (err) { setErro(erroDe(err, "Falha ao salvar a diretriz.")); } finally { setSaving(false); }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="modal__head"><h2>{initial ? "Editar diretriz" : "Nova diretriz"}</h2><button type="button" className="icon-btn" onClick={onClose} title="Fechar"><IconClose size={16} /></button></header>
        <div className="modal__body prod-form">
          <div className="prod-form__grid">
            <label className="prod-field prod-field--full"><span>Título</span><input required minLength={2} maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Missão, Valores, Prioridades 2026" /></label>
            <label className="prod-field prod-field--full"><span>Texto</span><textarea rows={5} required minLength={2} maxLength={8000} value={text} onChange={(e) => setText(e.target.value)} placeholder="O que a IA deve considerar como diretriz da empresa" /></label>
          </div>
          <p className="card__hint" style={{ margin: 0 }}>
            {initial?.status === "APROVADA" ? "Esta diretriz está aprovada: ao salvar, ela volta a Rascunho como nova versão e precisa ser aprovada de novo." : "Registrada como Rascunho. Envie para revisão e aprove para que passe a orientar a IA."}
          </p>
          {erro && <div className="dash-state dash-state--error" style={{ margin: 0 }}>{erro}</div>}
        </div>
        <div className="modal__foot">
          <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn--gold btn--sm" disabled={saving}>{saving ? "Salvando…" : initial ? "Salvar alterações" : "Criar"}</button>
        </div>
      </form>
    </div>
  );
}

// ── Aba Documentos Autorizados ─────────────────────────────────────────────

function DocumentosTab({ documentos, overview, canManage, onChanged }: {
  documentos: ReturnType<typeof useRecurso<TenantDocumentData[]>>;
  overview: TenantContextOverview | null;
  canManage: boolean;
  onChanged: () => void;
}) {
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [novo, setNovo] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const lista = useMemo(() => documentos.data ?? [], [documentos.data]);
  const filtrados = useMemo(() => (filtroStatus === "todos" ? lista : lista.filter((d) => d.status === filtroStatus)), [lista, filtroStatus]);
  const selecionado = useMemo(() => lista.find((d) => d.id === selId) ?? null, [lista, selId]);

  if (documentos.status === "loading") return <p className="dash-state">Carregando documentos…</p>;
  if (documentos.status === "error") return <div className="dash-state dash-state--error">Não foi possível carregar os documentos. {documentos.erro}</div>;

  return (
    <>
      {lista.length === 0 ? (
        <div className="dash-empty">
          <div className="dash-empty__ic"><IconFile /></div>
          <h3 className="dash-empty__title">Nenhum documento autorizado</h3>
          <p className="dash-empty__sub">Políticas, manuais e diretrizes formais da sua empresa (PDF, DOCX, planilha ou texto — ou um link). O documento entra como Rascunho; só depois de <strong>Aprovado/Publicado</strong> e vinculado a um caso de uso ativo a IA passa a consultá-lo.</p>
          {canManage ? <button className="btn btn--gold btn--sm" onClick={() => setNovo(true)}><IconPlus /> Adicionar documento</button> : <span className="card__hint">Cadastro disponível para quem tem a permissão “Gerir Contexto e Diretrizes”.</span>}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "end", marginBottom: 14 }}>
            <label className="prod-field" style={{ minWidth: 200 }}>
              <span>Status</span>
              <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
                <option value="todos">Todos os status</option>
                {TENANT_DOCUMENT_STATUSES.map((s) => <option key={s} value={s}>{TENANT_DOCUMENT_STATUS_LABEL[s]}</option>)}
              </select>
            </label>
            {canManage && <button className="btn btn--gold btn--sm" onClick={() => setNovo(true)}><IconPlus /> Adicionar documento</button>}
          </div>
          <div className="card" style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr><th>ID</th><th>Título</th><th>Tipo</th><th>Versão</th><th>Módulos</th><th>Acesso</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {filtrados.length === 0 && <tr><td colSpan={8} className="card__hint">Nenhum documento com este status.</td></tr>}
                {filtrados.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontFamily: "var(--font-mono, monospace)" }}>{d.code}</td>
                    <td>{d.title}</td>
                    <td>{d.kind}</td>
                    <td style={{ fontFamily: "var(--font-mono, monospace)" }}>{d.version}</td>
                    <td>{moduleNames(d.modules)}</td>
                    <td>{d.accessLevel}</td>
                    <td><span className={docPill(d.status)}>{TENANT_DOCUMENT_STATUS_LABEL[d.status]}</span></td>
                    <td><button className="btn btn--ghost btn--sm" onClick={() => setSelId(d.id)} title="Abrir"><IconEye /> Abrir</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {novo && <DocumentoForm overview={overview} onClose={() => setNovo(false)} onSaved={() => { setNovo(false); onChanged(); }} />}
      {selecionado && (
        <DocumentoDetalhe
          doc={selecionado}
          canManage={canManage}
          onClose={() => setSelId(null)}
          onChanged={onChanged}
        />
      )}
    </>
  );
}

function DocumentoForm({ overview, onClose, onSaved }: { overview: TenantContextOverview | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<CreateTenantDocumentRequest>({
    title: "", kind: "", cnpj: overview?.taxId ?? "", unitId: "", version: "v1.0", issuedAt: "", owner: "", purpose: "", modules: [], accessLevel: "", url: "",
  });
  const [fonte, setFonte] = useState<"arquivo" | "url">("arquivo");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const set = <K extends keyof CreateTenantDocumentRequest>(k: K, v: CreateTenantDocumentRequest[K]) => setF((s) => ({ ...s, [k]: v }));
  const toggleModule = (code: string) => set("modules", f.modules.includes(code) ? f.modules.filter((m) => m !== code) : [...f.modules, code]);
  const accept = TENANT_DOCUMENT_FILE_EXTENSIONS.map((e) => `.${e}`).join(",");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (fonte === "arquivo" && !file) { setErro("Selecione o arquivo do documento."); return; }
    if (fonte === "url" && !f.url?.trim()) { setErro("Informe a URL do documento."); return; }
    setSaving(true);
    setErro(null);
    try {
      await createContextDocument(
        { ...f, cnpj: f.cnpj?.trim() || null, unitId: f.unitId || null, issuedAt: f.issuedAt || null, url: fonte === "url" ? f.url?.trim() : null },
        fonte === "arquivo" ? file : null,
      );
      onSaved();
    } catch (err) { setErro(erroDe(err, "Falha ao adicionar o documento.")); } finally { setSaving(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal modal--wide" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="modal__head"><h2>Adicionar documento autorizado</h2><button type="button" className="icon-btn" onClick={onClose} title="Fechar"><IconClose size={16} /></button></header>
        <div className="modal__body prod-form">
          <div className="prod-form__grid">
            <label className="prod-field prod-field--full"><span>Título</span><input required minLength={2} maxLength={200} value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex.: Código de Conduta" /></label>
            <label className="prod-field"><span>Tipo</span><input required maxLength={80} list="ctx-kinds" value={f.kind} onChange={(e) => set("kind", e.target.value)} placeholder="Política, Manual, Diretriz…" /><datalist id="ctx-kinds"><option value="Política" /><option value="Manual" /><option value="Diretriz" /><option value="Procedimento" /></datalist></label>
            <label className="prod-field"><span>Versão</span><input maxLength={40} value={f.version ?? ""} onChange={(e) => set("version", e.target.value)} placeholder="v1.0" /></label>
            <label className="prod-field"><span>CNPJ</span><input maxLength={32} value={f.cnpj ?? ""} onChange={(e) => set("cnpj", e.target.value)} placeholder="CNPJ da empresa/unidade" /></label>
            <label className="prod-field">
              <span>Unidade</span>
              <select value={f.unitId ?? ""} onChange={(e) => set("unitId", e.target.value)}>
                <option value="">Consolidado (toda a empresa)</option>
                {(overview?.units ?? []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
            <label className="prod-field"><span>Data do documento</span><input type="date" value={f.issuedAt ?? ""} onChange={(e) => set("issuedAt", e.target.value)} /></label>
            <label className="prod-field"><span>Responsável</span><input required maxLength={160} value={f.owner} onChange={(e) => set("owner", e.target.value)} placeholder="Ex.: Compliance · Ana Rocha" /></label>
            <label className="prod-field prod-field--full"><span>Finalidade</span><textarea rows={2} required maxLength={2000} value={f.purpose} onChange={(e) => set("purpose", e.target.value)} placeholder="Para que a IA pode usar este documento" /></label>
            <div className="prod-field prod-field--full">
              <span>Módulos autorizados</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", fontSize: 13 }}>
                {MODULES.map((m) => (
                  <label key={m.code} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <input type="checkbox" checked={f.modules.includes(m.code)} onChange={() => toggleModule(m.code)} /> {m.name}
                  </label>
                ))}
              </div>
            </div>
            <label className="prod-field"><span>Nível de acesso</span><input required maxLength={120} value={f.accessLevel} onChange={(e) => set("accessLevel", e.target.value)} placeholder="Ex.: Todos os usuários, RH/SST + Liderança" /></label>
            <label className="prod-field">
              <span>Origem</span>
              <select value={fonte} onChange={(e) => setFonte(e.target.value as "arquivo" | "url")}>
                <option value="arquivo">Enviar arquivo (o texto é extraído para a IA)</option>
                <option value="url">Somente link (referência, sem texto para a IA)</option>
              </select>
            </label>
            {fonte === "arquivo" ? (
              <label className="prod-field prod-field--full"><span>Arquivo ({TENANT_DOCUMENT_FILE_EXTENSIONS.join(", ")} · até 8 MB)</span><input type="file" accept={accept} onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
            ) : (
              <label className="prod-field prod-field--full"><span>URL</span><input type="url" maxLength={2000} value={f.url ?? ""} onChange={(e) => set("url", e.target.value)} placeholder="https://…" /></label>
            )}
          </div>
          <p className="card__hint" style={{ margin: 0 }}>Documentos entram como Rascunho. Só o texto de documentos Aprovado/Publicado chega à IA; um link entra apenas como referência.</p>
          {erro && <div className="dash-state dash-state--error" style={{ margin: 0 }}>{erro}</div>}
        </div>
        <div className="modal__foot">
          <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn--gold btn--sm" disabled={saving}>{saving ? "Enviando…" : "Adicionar"}</button>
        </div>
      </form>
    </div>
  );
}

function DocumentoDetalhe({ doc, canManage, onClose, onChanged }: { doc: TenantDocumentData; canManage: boolean; onClose: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [substituindo, setSubstituindo] = useState(false);
  const [revogando, setRevogando] = useState(false);
  const terminal = doc.status === "SUBSTITUIDO" || doc.status === "REVOGADO";

  async function mudar(status: TenantDocumentStatus) {
    setBusy(true);
    setErro(null);
    try { await changeContextDocumentStatus(doc.id, { status }); onChanged(); } catch (e) { setErro(erroDe(e, "Falha ao mudar o status.")); } finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <div>
            <h2>{doc.title}</h2>
            <span className="card__hint">{doc.code} · {doc.kind} · {doc.version}</span>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} title="Fechar"><IconClose size={16} /></button>
        </header>
        <div className="modal__body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <span className={docPill(doc.status)}>{TENANT_DOCUMENT_STATUS_LABEL[doc.status]}</span>
            <span className="pill">{doc.accessLevel}</span>
            {doc.replacedByCode && <span className="pill">Substituído por {doc.replacedByCode}</span>}
          </div>
          <div className="prod-form__grid">
            <Field label="CNPJ / Unidade" value={`${doc.cnpj ?? "—"} · ${doc.unitName ?? "Consolidado"}`} />
            <Field label="Data" value={fmtDate(doc.issuedAt)} />
            <Field label="Responsável" value={doc.owner} />
            <Field label="Aprovação" value={doc.approvedAt ? `${fmtDate(doc.approvedAt)} · ${doc.approvedByName ?? "—"}` : "—"} />
            <Field label="Finalidade" value={doc.purpose} />
            <Field label="Módulos autorizados" value={moduleNames(doc.modules)} />
            <Field label="Origem" value={doc.fileName ? (
              <>
                {doc.fileName} · {doc.extractedChars > 0 ? `${doc.extractedChars.toLocaleString("pt-BR")} caracteres extraídos` : "sem texto extraído"}{" "}
                <button className="btn btn--ghost btn--sm" onClick={() => downloadContextDocumentFile(doc.id, doc.fileName!).catch((e) => setErro(erroDe(e, "Falha ao baixar.")))}><IconDownload /> Baixar</button>
              </>
            ) : doc.url ? <a href={doc.url} target="_blank" rel="noreferrer">{doc.url}</a> : "—"} />
            {doc.revokeJustification && <Field label="Motivo da revogação" value={doc.revokeJustification} />}
          </div>

          {substituindo && (
            <SubstituirBloco doc={doc} onCancel={() => setSubstituindo(false)} onDone={() => { setSubstituindo(false); onChanged(); onClose(); }} />
          )}
          {erro && <div className="dash-state dash-state--error" style={{ margin: 0 }}>{erro}</div>}
        </div>
        <div className="modal__foot" style={{ flexWrap: "wrap", gap: 6 }}>
          {canManage && !terminal && !substituindo && (
            <>
              {doc.status === "RASCUNHO" && <button className="btn btn--outline-dark btn--sm" disabled={busy} onClick={() => mudar("EM_REVISAO")}>Enviar para revisão</button>}
              {doc.status === "EM_REVISAO" && <button className="btn btn--gold btn--sm" disabled={busy} onClick={() => mudar("APROVADO_PUBLICADO")}>Aprovar/Publicar</button>}
              {doc.status === "EM_REVISAO" && <button className="btn btn--outline-dark btn--sm" disabled={busy} onClick={() => mudar("RASCUNHO")}>Devolver a rascunho</button>}
              <button className="btn btn--outline-dark btn--sm" disabled={busy} onClick={() => setSubstituindo(true)}>Substituir</button>
              <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => setRevogando(true)}>Revogar</button>
            </>
          )}
          <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>Fechar</button>
        </div>
      </div>
      {revogando && (
        <JustificativaModal
          titulo={`Revogar ${doc.code}`}
          descricao="O documento deixa de alimentar a IA e sai de todos os casos de uso. Revogar é definitivo."
          confirmar="Revogar documento"
          onClose={() => setRevogando(false)}
          onConfirm={async (justification) => { await revokeContextDocument(doc.id, justification); setRevogando(false); onChanged(); onClose(); }}
        />
      )}
    </div>
  );
}

function SubstituirBloco({ doc, onCancel, onDone }: { doc: TenantDocumentData; onCancel: () => void; onDone: () => void }) {
  const [fonte, setFonte] = useState<"arquivo" | "url">(doc.fileName ? "arquivo" : "url");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [version, setVersion] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const accept = TENANT_DOCUMENT_FILE_EXTENSIONS.map((e) => `.${e}`).join(",");

  async function submit() {
    if (fonte === "arquivo" && !file) { setErro("Selecione o arquivo da nova versão."); return; }
    if (fonte === "url" && !url.trim()) { setErro("Informe a URL da nova versão."); return; }
    setBusy(true);
    setErro(null);
    try {
      await replaceContextDocument(doc.id, { version: version.trim() || undefined, url: fonte === "url" ? url.trim() : null }, fonte === "arquivo" ? file : null);
      onDone();
    } catch (e) { setErro(erroDe(e, "Falha ao substituir.")); setBusy(false); }
  }

  return (
    <div className="card" style={{ margin: 0 }}>
      <div className="card__head"><div><h3>Substituir por nova versão</h3><span className="card__sub">{doc.code} vira “Substituído”; a nova versão entra como Rascunho, herda os vínculos e só alimenta a IA depois de aprovada.</span></div></div>
      <div className="prod-form">
        <div className="prod-form__grid">
          <label className="prod-field"><span>Versão (opcional)</span><input maxLength={40} value={version} onChange={(e) => setVersion(e.target.value)} placeholder={`Em branco: incrementa ${doc.version}`} /></label>
          <label className="prod-field">
            <span>Origem</span>
            <select value={fonte} onChange={(e) => setFonte(e.target.value as "arquivo" | "url")}>
              <option value="arquivo">Enviar arquivo</option>
              <option value="url">Somente link</option>
            </select>
          </label>
          {fonte === "arquivo" ? (
            <label className="prod-field prod-field--full"><span>Arquivo</span><input type="file" accept={accept} onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
          ) : (
            <label className="prod-field prod-field--full"><span>URL</span><input type="url" maxLength={2000} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></label>
          )}
        </div>
        {erro && <div className="dash-state dash-state--error" style={{ margin: "8px 0 0" }}>{erro}</div>}
        <div style={{ display: "flex", gap: 6, marginTop: 10, justifyContent: "flex-end" }}>
          <button type="button" className="btn btn--outline-dark btn--sm" disabled={busy} onClick={onCancel}>Cancelar</button>
          <button type="button" className="btn btn--gold btn--sm" disabled={busy} onClick={submit}>{busy ? "Enviando…" : "Registrar nova versão"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Aba Terminologia e Regras ──────────────────────────────────────────────

function TermosTab({ termos, canManage, onChanged }: { termos: ReturnType<typeof useRecurso<TenantTermData[]>>; canManage: boolean; onChanged: () => void }) {
  const [form, setForm] = useState<{ open: boolean; initial: TenantTermData | null }>({ open: false, initial: null });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const lista = termos.data ?? [];

  async function remover(t: TenantTermData) {
    if (!window.confirm(`Remover o termo “${t.term}”?`)) return;
    setBusyId(t.id);
    setErro(null);
    try { await deleteContextTerm(t.id); onChanged(); } catch (e) { setErro(erroDe(e, "Falha ao remover.")); } finally { setBusyId(null); }
  }

  if (termos.status === "loading") return <p className="dash-state">Carregando terminologia…</p>;
  if (termos.status === "error") return <div className="dash-state dash-state--error">Não foi possível carregar a terminologia. {termos.erro}</div>;

  return (
    <>
      {lista.length === 0 ? (
        <div className="dash-empty">
          <div className="dash-empty__ic"><IconBook /></div>
          <h3 className="dash-empty__title">Nenhum termo cadastrado</h3>
          <p className="dash-empty__sub">Vocabulário e regras de negócio da sua empresa (o que é “ciclo”, “líder”, “ação prioritária” aqui dentro) para a IA e os relatórios falarem a mesma língua que vocês.</p>
          {canManage ? <button className="btn btn--gold btn--sm" onClick={() => setForm({ open: true, initial: null })}><IconPlus /> Novo termo</button> : <span className="card__hint">Cadastro disponível para quem tem a permissão “Gerir Contexto e Diretrizes”.</span>}
        </div>
      ) : (
        <>
          {canManage && <div style={{ marginBottom: 14 }}><button className="btn btn--gold btn--sm" onClick={() => setForm({ open: true, initial: null })}><IconPlus /> Novo termo</button></div>}
          {erro && <div className="dash-state dash-state--error" style={{ marginBottom: 12 }}>{erro}</div>}
          <div className="grid grid--2">
            {lista.map((t) => (
              <div key={t.id} className="card" style={{ marginBottom: 0 }}>
                <div className="card__head" style={{ alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ margin: 0 }}>{t.term}</h3>
                    <span className="card__sub">{t.definition}</span>
                  </div>
                </div>
                <p className="card__hint" style={{ margin: "6px 0 0" }}>Contexto: {t.context}</p>
                {canManage && (
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    <button className="btn btn--outline-dark btn--sm" disabled={busyId === t.id} onClick={() => setForm({ open: true, initial: t })}>Editar</button>
                    <button className="btn btn--ghost btn--sm" disabled={busyId === t.id} onClick={() => remover(t)}>Remover</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      {form.open && <TermoForm initial={form.initial} onClose={() => setForm({ open: false, initial: null })} onSaved={() => { setForm({ open: false, initial: null }); onChanged(); }} />}
    </>
  );
}

function TermoForm({ initial, onClose, onSaved }: { initial: TenantTermData | null; onClose: () => void; onSaved: () => void }) {
  const [term, setTerm] = useState(initial?.term ?? "");
  const [definition, setDefinition] = useState(initial?.definition ?? "");
  const [context, setContext] = useState(initial?.context ?? "");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErro(null);
    try {
      const dto = { term: term.trim(), definition: definition.trim(), context: context.trim() };
      if (initial) await updateContextTerm(initial.id, dto);
      else await createContextTerm(dto);
      onSaved();
    } catch (err) { setErro(erroDe(err, "Falha ao salvar o termo.")); } finally { setSaving(false); }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="modal__head"><h2>{initial ? "Editar termo" : "Novo termo"}</h2><button type="button" className="icon-btn" onClick={onClose} title="Fechar"><IconClose size={16} /></button></header>
        <div className="modal__body prod-form">
          <div className="prod-form__grid">
            <label className="prod-field prod-field--full"><span>Termo</span><input required maxLength={120} value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Ex.: Ciclo" /></label>
            <label className="prod-field prod-field--full"><span>Definição</span><textarea rows={3} required maxLength={2000} value={definition} onChange={(e) => setDefinition(e.target.value)} placeholder="Ex.: Período de 6 meses usado para diagnósticos e planos." /></label>
            <label className="prod-field prod-field--full"><span>Contexto (onde vale)</span><input required maxLength={200} value={context} onChange={(e) => setContext(e.target.value)} placeholder="Ex.: Todos os módulos · Liderança, NR-1" /></label>
          </div>
          {erro && <div className="dash-state dash-state--error" style={{ margin: 0 }}>{erro}</div>}
        </div>
        <div className="modal__foot">
          <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn--gold btn--sm" disabled={saving}>{saving ? "Salvando…" : initial ? "Salvar" : "Criar"}</button>
        </div>
      </form>
    </div>
  );
}

// ── Aba Casos de Uso da IA ─────────────────────────────────────────────────

function CasosTab({ casos, documentos, canManage, onChanged }: {
  casos: ReturnType<typeof useRecurso<TenantAiUseCasesResponse>>;
  documentos: TenantDocumentData[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const [editando, setEditando] = useState<TenantAiUseCaseContextData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const allowed = casos.data?.customAiAllowed ?? false;
  const vivos = useMemo(() => documentos.filter((d) => d.status !== "SUBSTITUIDO" && d.status !== "REVOGADO"), [documentos]);

  async function alternar(c: TenantAiUseCaseContextData) {
    setBusy(c.useCase);
    setErro(null);
    try { await updateContextAiUseCase(c.useCase, { documentIds: c.documentIds, active: !c.active }); onChanged(); } catch (e) { setErro(erroDe(e, "Falha ao alternar.")); } finally { setBusy(null); }
  }

  if (casos.status === "loading") return <p className="dash-state">Carregando casos de uso…</p>;
  if (casos.status === "error") return <div className="dash-state dash-state--error">Não foi possível carregar os casos de uso. {casos.erro}</div>;

  return (
    <>
      <p className="card__hint" style={{ marginBottom: 12 }}>
        Os casos são os da Central de Prompts da plataforma. Para cada um, escolha quais documentos autorizados a IA pode consultar e ligue o uso contextual. Só documentos <strong>Aprovado/Publicado</strong> chegam ao prompt — os demais ficam vinculados, mas não entram até serem aprovados.
      </p>
      {!allowed && <div className="dash-state" style={{ marginBottom: 12 }}>O uso contextual não pode ser ligado: o produto contratado não inclui a IA Contextualizada (adicional premium). Os vínculos podem ser preparados desde já.</div>}
      {erro && <div className="dash-state dash-state--error" style={{ marginBottom: 12 }}>{erro}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(casos.data?.items ?? []).map((c) => (
          <div key={c.useCase} className="card" style={{ margin: 0 }}>
            <div className="card__head" style={{ alignItems: "center" }}>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ margin: 0 }}>{c.label}</h3>
                <span className="card__sub">Documentos autorizados: {c.documentCodes.length ? c.documentCodes.join(", ") : "nenhum"}</span>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0, flexWrap: "wrap" }}>
                <span className={c.active ? "pill pill--gold" : "pill"}>{c.active ? "Uso contextual ativo" : "Desativado"}</span>
                {canManage && (
                  <>
                    <button className="btn btn--outline-dark btn--sm" disabled={busy === c.useCase} onClick={() => setEditando(c)}>Documentos</button>
                    <button className="btn btn--ghost btn--sm" disabled={busy === c.useCase || (!allowed && !c.active)} title={!allowed && !c.active ? "Requer o adicional IA Contextualizada" : undefined} onClick={() => alternar(c)}>Alternar</button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {editando && (
        <CasoDocsModal
          caso={editando}
          documentos={vivos}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); onChanged(); }}
        />
      )}
    </>
  );
}

function CasoDocsModal({ caso, documentos, onClose, onSaved }: { caso: TenantAiUseCaseContextData; documentos: TenantDocumentData[]; onClose: () => void; onSaved: () => void }) {
  const [ids, setIds] = useState<string[]>(caso.documentIds);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const toggle = (id: string) => setIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErro(null);
    try { await updateContextAiUseCase(caso.useCase, { documentIds: ids, active: caso.active }); onSaved(); } catch (err) { setErro(erroDe(err, "Falha ao salvar.")); setSaving(false); }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="modal__head"><h2>{caso.label}</h2><button type="button" className="icon-btn" onClick={onClose} title="Fechar"><IconClose size={16} /></button></header>
        <div className="modal__body prod-form">
          <p className="card__hint" style={{ margin: 0 }}>Documentos que este caso de uso pode consultar. Substituídos e revogados não aparecem.</p>
          {documentos.length === 0 ? (
            <p className="dash-state" style={{ margin: 0 }}>Nenhum documento disponível — cadastre na aba Documentos Autorizados.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14 }}>
              {documentos.map((d) => (
                <label key={d.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" checked={ids.includes(d.id)} onChange={() => toggle(d.id)} />
                  <span style={{ fontFamily: "var(--font-mono, monospace)" }}>{d.code}</span> {d.title}
                  <span className={docPill(d.status)} style={{ fontSize: 11 }}>{TENANT_DOCUMENT_STATUS_LABEL[d.status]}</span>
                </label>
              ))}
            </div>
          )}
          {erro && <div className="dash-state dash-state--error" style={{ margin: 0 }}>{erro}</div>}
        </div>
        <div className="modal__foot">
          <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn--gold btn--sm" disabled={saving}>{saving ? "Salvando…" : "Salvar vínculos"}</button>
        </div>
      </form>
    </div>
  );
}

// ── Aba Histórico e Auditoria ──────────────────────────────────────────────

const ACTION_LABEL: Record<string, string> = {
  "context.directive.create": "Diretriz criada",
  "context.directive.update": "Diretriz editada",
  "context.directive.status": "Diretriz mudou de status",
  "context.document.create": "Documento adicionado",
  "context.document.status": "Documento mudou de status",
  "context.document.replace": "Documento substituído",
  "context.document.revoke": "Documento revogado",
  "context.term.create": "Termo criado",
  "context.term.update": "Termo editado",
  "context.term.delete": "Termo removido",
  "context.ai_use_case.update": "Caso de uso da IA atualizado",
};

function descreveEvento(e: TenantContextAuditEntry): string {
  const m = e.meta ?? {};
  const nome = typeof m.title === "string" ? m.title : typeof m.term === "string" ? m.term : typeof m.useCase === "string" ? m.useCase : e.target ?? "";
  const partes: string[] = [];
  if (typeof m.code === "string") partes.push(m.code);
  if (nome) partes.push(nome);
  if (typeof m.from === "string" && typeof m.to === "string") partes.push(`${m.from} → ${m.to}`);
  if (typeof m.replacedBy === "string") partes.push(`por ${m.replacedBy}`);
  if (typeof m.active === "boolean") partes.push(m.active ? "uso contextual ativo" : "desativado");
  if (Array.isArray(m.documents)) partes.push(`documentos: ${(m.documents as string[]).join(", ") || "nenhum"}`);
  if (typeof m.justification === "string") partes.push(`justificativa: ${m.justification}`);
  return partes.join(" · ");
}

function HistoricoTab({ auditoria }: { auditoria: ReturnType<typeof useRecurso<TenantContextAuditEntry[]>> }) {
  if (auditoria.status === "loading") return <p className="dash-state">Carregando histórico…</p>;
  if (auditoria.status === "error") return <div className="dash-state dash-state--error">Não foi possível carregar o histórico. {auditoria.erro}</div>;
  const lista = auditoria.data ?? [];
  if (lista.length === 0) {
    return <div className="dash-state">Nenhum evento registrado ainda. Cada cadastro, aprovação, substituição, revogação e alteração de caso de uso aparece aqui com data, autor e justificativa.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {lista.map((e) => (
        <div key={e.id} className="card" style={{ margin: 0, padding: "12px 16px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "baseline" }}>
            <span className="card__hint" style={{ fontFamily: "var(--font-mono, monospace)" }}>{fmtDateTime(e.at)}</span>
            <strong style={{ fontSize: 14 }}>{ACTION_LABEL[e.action] ?? e.action}</strong>
            <span style={{ fontSize: 13, color: "var(--text-sec)" }}>{descreveEvento(e)}</span>
            {e.actorEmail && <span className="card__hint">por {e.actorEmail}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
