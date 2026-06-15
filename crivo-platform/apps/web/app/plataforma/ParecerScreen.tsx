"use client";

import { useEffect, useState } from "react";
import type { ParecerData, UpsertParecerRequest } from "@crivo/types";
import { PARECER_STATUS_LABEL } from "@crivo/types";
import {
  createParecer,
  generateParecerDocument,
  getMyPermissions,
  listPareceres,
  publishParecer,
  updateParecer,
} from "@/lib/api";
import { printDocument } from "./DocumentsPanel";
import { useIcdDashboard, PATTERN_LABEL, DIMENSION_LABEL } from "./useIcdDashboard";

const DIMENSIONS = ["reatividade", "rigidez", "repercussao", "risco"] as const;

function barClass(v: number): string {
  if (v >= 80) return "is-high";
  if (v >= 60) return "is-mid";
  return "is-low";
}

type Form = {
  title: string;
  context: string;
  signals: string;
  hypotheses: string;
  priorities: string;
  recommendations: string;
  devolutivaAt: string;
};

const EMPTY_FORM: Form = {
  title: "Parecer Consultivo CRIVO",
  context: "",
  signals: "",
  hypotheses: "",
  priorities: "",
  recommendations: "",
  devolutivaAt: "",
};

function toForm(p: ParecerData): Form {
  return {
    title: p.title,
    context: p.context ?? "",
    signals: p.signals ?? "",
    hypotheses: p.hypotheses ?? "",
    priorities: p.priorities ?? "",
    recommendations: p.recommendations ?? "",
    devolutivaAt: p.devolutivaAt ? p.devolutivaAt.slice(0, 10) : "",
  };
}

function toPayload(f: Form): UpsertParecerRequest {
  return {
    title: f.title.trim() || "Parecer Consultivo CRIVO",
    context: f.context.trim() || null,
    signals: f.signals.trim() || null,
    hypotheses: f.hypotheses.trim() || null,
    priorities: f.priorities.trim() || null,
    recommendations: f.recommendations.trim() || null,
    devolutivaAt: f.devolutivaAt ? f.devolutivaAt : null,
  };
}

/**
 * Parecer Consultivo CRIVO (Portal §6). Mostra a diferença da CRIVO: indicadores
 * CONSOLIDADOS (automáticos, agregados — sem dados individuais) + a leitura
 * HUMANA de um especialista. O parecer não é gerado por IA nem promete
 * conformidade automática: trabalha com sinais, hipóteses, prioridades e
 * recomendações. Quem tem parecer:manage (Consultor CRIVO, gestão) redige e
 * publica; os demais leem o parecer entregue e baixam o documento.
 */
export function ParecerScreen() {
  const { data, status, refresh } = useIcdDashboard();
  const [pareceres, setPareceres] = useState<ParecerData[] | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    try {
      const list = await listPareceres();
      setPareceres(list);
      // Carrega o mais recente no editor por padrão (ou começa em branco).
      if (list.length) {
        setEditingId(list[0].id);
        setForm(toForm(list[0]));
      } else {
        setEditingId(null);
        setForm(EMPTY_FORM);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao carregar pareceres");
      setPareceres([]);
    }
  }

  useEffect(() => {
    let alive = true;
    getMyPermissions()
      .then((perms) => { if (alive) setCanManage(perms.includes("parecer:manage")); })
      .catch(() => {});
    reload();
    return () => { alive = false; };
  }, []);

  const current = pareceres?.find((p) => p.id === editingId) ?? null;
  const published = pareceres?.find((p) => p.status === "PUBLICADO") ?? null;
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const temaCritico = (() => {
    if (!data) return null;
    const entries = Object.entries(data.distribuicaoPadrao).filter(([k]) => k !== "EQUILIBRADO");
    if (!entries.length) return "EQUILIBRADO";
    return entries.sort((a, b) => b[1] - a[1])[0][0];
  })();

  async function save() {
    setBusy("save"); setErr(null);
    try {
      const saved = editingId
        ? await updateParecer(editingId, toPayload(form))
        : await createParecer(toPayload(form));
      setEditingId(saved.id);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao salvar");
    } finally { setBusy(null); }
  }

  async function publish() {
    if (!editingId) return;
    setBusy("publish"); setErr(null);
    try { await publishParecer(editingId); await reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Falha ao publicar"); }
    finally { setBusy(null); }
  }

  function newDraft() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function download(id: string) {
    setBusy("download"); setErr(null);
    try { printDocument(await generateParecerDocument(id)); }
    catch (e) { setErr(e instanceof Error ? e.message : "Falha ao gerar documento"); }
    finally { setBusy(null); }
  }

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Parecer Consultivo CRIVO</h1>
          <p className="page-sub">Os dados são automáticos. A leitura final é de um especialista — não de um algoritmo.</p>
        </div>
        <div className="route__actions">
          <button className="btn btn--outline-dark btn--sm" onClick={refresh} disabled={status === "loading"}>
            {status === "loading" ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>

      {status === "loading" && <p className="dash-state">Carregando indicadores consolidados…</p>}
      {status === "error" && (
        <div className="dash-state dash-state--error">
          Não foi possível carregar os indicadores.{" "}
          <button className="btn btn--outline-dark btn--sm" onClick={refresh}>Tentar novamente</button>
        </div>
      )}

      {status === "ok" && data && (
        <>
          {/* Fluxo: dados consolidados → análise do consultor → parecer entregue */}
          <div className="kpi-grid">
            <div className="kpi">
              <span className="kpi__label">1 · Dados consolidados</span>
              <strong className="kpi__value">✓</strong>
              <span className="kpi__delta">{data.totalAvaliacoes} respostas · {data.totalLideres} líderes</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">2 · Análise do consultor</span>
              <strong className="kpi__value">{published ? "✓" : "●"}</strong>
              <span className="kpi__delta">
                {published ? "parecer redigido pelo especialista" : "leitura humana especializada — em curso"}
              </span>
            </div>
            <div className="kpi">
              <span className="kpi__label">3 · Parecer entregue</span>
              <strong className="kpi__value">{published ? "✓" : "—"}</strong>
              <span className="kpi__delta">
                {published
                  ? (published.devolutivaAt
                      ? `devolutiva em ${new Date(published.devolutivaAt).toLocaleDateString("pt-BR")}`
                      : "publicado · devolutiva a agendar")
                  : "previsto após a devolutiva"}
              </span>
            </div>
          </div>

          <div className="grid grid--2">
            {/* Indicadores consolidados (agregados — sem dados individuais) */}
            <div className="card">
              <div className="card__head">
                <div>
                  <h3>Indicadores consolidados</h3>
                  <span className="card__sub">Gerados pela plataforma — base para o parecer humano</span>
                </div>
              </div>
              <div className="kpi-grid">
                <div className="kpi">
                  <span className="kpi__label">Índice Geral CRIVO</span>
                  <strong className="kpi__value">{data.icdMedio ?? "—"}</strong>
                  <span className="kpi__delta">leitura agregada da liderança</span>
                </div>
                <div className="kpi">
                  <span className="kpi__label">Tema crítico predominante</span>
                  <strong className="kpi__value" style={{ fontSize: "20px" }}>
                    {temaCritico ? (PATTERN_LABEL[temaCritico] ?? temaCritico) : "—"}
                  </strong>
                  <span className="kpi__delta">tensão dominante nos 4 Rs</span>
                </div>
              </div>
              <div className="icd-dims" style={{ marginTop: "16px" }}>
                {DIMENSIONS.map((d) => {
                  const v = data.dimensionAverages?.[d] ?? 0;
                  return (
                    <div className="icd-dim" key={d}>
                      <div className="icd-dim__top">
                        <span>{DIMENSION_LABEL[d] ?? d}</span>
                        <strong>{v}</strong>
                      </div>
                      <div className="icd-dim__bar">
                        <div className={`icd-dim__fill ${barClass(v)}`} style={{ width: `${v}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Parecer do especialista (camada humana) */}
            <div className="card card--feature">
              <span className="card__eyebrow">PARECER DO ESPECIALISTA</span>
              <p className="card__hint" style={{ marginTop: "8px" }}>
                A leitura final é humana: trabalha com <strong>sinais, hipóteses, prioridades e recomendações</strong> —
                sem causalidade absoluta e sem prometer conformidade automática.
              </p>

              {published ? (
                <div className="kpi" style={{ marginTop: "12px" }}>
                  <span className="kpi__label">Parecer publicado</span>
                  <strong className="kpi__value" style={{ fontSize: "18px" }}>{published.title}</strong>
                  <span className="kpi__delta">
                    {published.author ? `por ${published.author}` : "consultor CRIVO"}
                    {published.publishedAt ? ` · ${new Date(published.publishedAt).toLocaleDateString("pt-BR")}` : ""}
                  </span>
                </div>
              ) : (
                <p className="card__hint">
                  O consultor consolida os indicadores acima, cruza com o contexto da empresa e entrega o parecer com a
                  devolutiva.
                </p>
              )}

              <div className="hero__ctas" style={{ marginTop: "16px" }}>
                <button
                  className="btn btn--gold btn--sm"
                  disabled={!published || busy === "download"}
                  title={published ? "Gerar PDF do parecer" : "Disponível após a publicação do parecer"}
                  onClick={() => published && download(published.id)}
                >
                  {busy === "download" ? "Gerando…" : "Baixar parecer (PDF)"}
                </button>
              </div>
              {!canManage && !published && (
                <p className="card__hint" style={{ marginTop: "12px", opacity: 0.8 }}>
                  O parecer ainda está em elaboração pelo consultor responsável.
                </p>
              )}
            </div>
          </div>

          {/* Autoria — somente para quem tem parecer:manage (Consultor CRIVO / gestão) */}
          {canManage && (
            <div className="card" style={{ marginTop: "18px" }}>
              <div className="card__head">
                <div>
                  <h3>Redigir parecer</h3>
                  <span className="card__sub">Camada humana — sinais, hipóteses, prioridades e recomendações.</span>
                </div>
                <div className="route__actions">
                  <button className="btn btn--outline-dark btn--sm" onClick={newDraft} disabled={busy !== null}>
                    Novo parecer
                  </button>
                </div>
              </div>

              <div className="prod-form__grid">
                {pareceres && pareceres.length > 0 && (
                  <label className="prod-field prod-field--full">
                    <span>Parecer</span>
                    <select
                      value={editingId ?? ""}
                      onChange={(e) => {
                        const p = pareceres.find((x) => x.id === e.target.value);
                        if (p) { setEditingId(p.id); setForm(toForm(p)); } else { newDraft(); }
                      }}
                    >
                      <option value="">— Novo parecer —</option>
                      {pareceres.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} · {PARECER_STATUS_LABEL[p.status]}
                          {p.publishedAt ? ` (${new Date(p.publishedAt).toLocaleDateString("pt-BR")})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="prod-field prod-field--full">
                  <span>Título</span>
                  <input value={form.title} onChange={set("title")} placeholder="Parecer Consultivo CRIVO" />
                </label>
                <label className="prod-field prod-field--full">
                  <span>Contexto e leitura da empresa</span>
                  <textarea rows={3} value={form.context} onChange={set("context")} placeholder="Momento, setor, fatores de contexto relevantes…" />
                </label>
                <label className="prod-field prod-field--full">
                  <span>Sinais observados</span>
                  <textarea rows={3} value={form.signals} onChange={set("signals")} placeholder="O que os indicadores e a escuta sinalizam (sem causalidade absoluta)…" />
                </label>
                <label className="prod-field prod-field--full">
                  <span>Hipóteses de trabalho</span>
                  <textarea rows={3} value={form.hypotheses} onChange={set("hypotheses")} placeholder="Hipóteses a validar com a liderança…" />
                </label>
                <label className="prod-field prod-field--full">
                  <span>Prioridades</span>
                  <textarea rows={3} value={form.priorities} onChange={set("priorities")} placeholder="O que tratar primeiro e por quê…" />
                </label>
                <label className="prod-field prod-field--full">
                  <span>Recomendações</span>
                  <textarea rows={3} value={form.recommendations} onChange={set("recommendations")} placeholder="Recomendações práticas para o plano de ação…" />
                </label>
                <label className="prod-field">
                  <span>Devolutiva (data)</span>
                  <input type="date" value={form.devolutivaAt} onChange={set("devolutivaAt")} />
                </label>
              </div>

              {err && <p className="dash-state dash-state--error" style={{ marginTop: "8px" }}>{err}</p>}

              <div className="hero__ctas" style={{ marginTop: "12px" }}>
                <button className="btn btn--outline-dark btn--sm" onClick={save} disabled={busy !== null}>
                  {busy === "save" ? "Salvando…" : editingId ? "Salvar alterações" : "Criar rascunho"}
                </button>
                <button
                  className="btn btn--gold btn--sm"
                  onClick={publish}
                  disabled={!editingId || busy !== null}
                  title={editingId ? "Publicar e liberar o documento" : "Salve o rascunho antes de publicar"}
                >
                  {busy === "publish" ? "Publicando…" : "Publicar parecer"}
                </button>
                {current?.status === "PUBLICADO" && (
                  <button className="btn btn--outline-dark btn--sm" onClick={() => download(current.id)} disabled={busy !== null}>
                    {busy === "download" ? "Gerando…" : "Baixar PDF"}
                  </button>
                )}
              </div>
              {current && (
                <p className="card__hint" style={{ marginTop: "10px", opacity: 0.8 }}>
                  Status atual: <strong>{PARECER_STATUS_LABEL[current.status]}</strong>
                  {current.status === "PUBLICADO" ? " — alterações exigem novo Publicar para refletir no PDF." : " — ainda é minuta; publique para liberar o documento."}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
