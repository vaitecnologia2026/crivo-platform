"use client";

import { useEffect, useState } from "react";
import {
  createMethodologyDraft,
  deleteMethodologyDraft,
  getActiveMethodology,
  getMethodologyVersion,
  listMethodologyVersions,
  publishMethodology,
  updateMethodologyDraft,
  type MethodologyInstrument,
  type MethodologyVersion,
  type MethodologyVersionSummary,
} from "../../lib/admin-api";
import "./cnae.css";

const INSTRUMENTS: { key: MethodologyInstrument; label: string; bandKind: "MATURITY" | "RISK"; bandWord: string }[] = [
  { key: "PRE_DIAGNOSTIC", label: "Diagnóstico Inicial (LP)", bandKind: "MATURITY", bandWord: "Faixas de maturidade" },
  { key: "PSYCHOSOCIAL", label: "Diagnóstico Organizacional", bandKind: "RISK", bandWord: "Faixas de risco" },
];

type Dim = { slug: string; label: string; weight: number };
type Q = { dimensionSlug: string; text: string; weight: number; inverse: boolean };
type Band = { kind: "MATURITY" | "RISK"; code: string; label: string; min: number; max: number };

export function MethodologySection() {
  const [instrument, setInstrument] = useState<MethodologyInstrument>("PSYCHOSOCIAL");
  const meta = INSTRUMENTS.find((i) => i.key === instrument)!;
  const [active, setActive] = useState<MethodologyVersion | null>(null);
  const [versions, setVersions] = useState<MethodologyVersionSummary[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [dims, setDims] = useState<Dim[]>([]);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [bands, setBands] = useState<Band[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setErr(null);
    setMsg(null);
    try {
      const [a, vs] = await Promise.all([getActiveMethodology(instrument), listMethodologyVersions(instrument)]);
      setActive(a);
      setVersions(vs);
      const draft = vs.find((v) => v.status === "DRAFT");
      if (draft) await loadDraft(draft.id);
      else {
        setDraftId(null);
        setDims([]);
        setQuestions([]);
        setBands([]);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao carregar.");
    }
  }

  async function loadDraft(id: string) {
    const d = await getMethodologyVersion(id);
    setDraftId(d.id);
    setLabel(d.label);
    setDims(d.dimensions.map((x) => ({ slug: x.slug, label: x.label, weight: x.weight })));
    setQuestions(d.questions.map((x) => ({ dimensionSlug: x.dimensionSlug, text: x.text, weight: x.weight, inverse: x.inverse })));
    setBands(d.bands.map((x) => ({ kind: x.kind, code: x.code, label: x.label, min: x.min, max: x.max })));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instrument]);

  async function startDraft() {
    setBusy("draft");
    setErr(null);
    try {
      const d = await createMethodologyDraft(instrument);
      await load();
      await loadDraft(d.id);
      setMsg("Rascunho criado a partir da versão ativa. Edite e publique.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao criar rascunho.");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!draftId) return;
    setBusy("save");
    setErr(null);
    setMsg(null);
    try {
      await updateMethodologyDraft(draftId, { label, dimensions: dims, questions, bands });
      setMsg("Rascunho salvo.");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setBusy(null);
    }
  }

  async function publish() {
    if (!draftId) return;
    if (!window.confirm("Publicar este rascunho? Ele vira a versão ATIVA e a anterior é arquivada.")) return;
    setBusy("publish");
    setErr(null);
    setMsg(null);
    try {
      await updateMethodologyDraft(draftId, { label, dimensions: dims, questions, bands });
      await publishMethodology(draftId);
      setMsg("Publicado! Esta é a nova versão ativa.");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao publicar.");
    } finally {
      setBusy(null);
    }
  }

  async function discard() {
    if (!draftId) return;
    if (!window.confirm("Descartar este rascunho?")) return;
    setBusy("discard");
    try {
      await deleteMethodologyDraft(draftId);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao descartar.");
    } finally {
      setBusy(null);
    }
  }

  const editing = !!draftId;

  return (
    <div>
      <p className="cnae-muted" style={{ marginTop: 0 }}>
        Configure <strong>dimensões, perguntas, pesos e faixas</strong> de cada instrumento — sem depender de
        desenvolvimento. Edita-se um <strong>rascunho</strong> e publica-se: vira a versão ativa, a anterior é arquivada.
      </p>

      <div className="cnae-tabs" style={{ marginBottom: 14 }}>
        {INSTRUMENTS.map((i) => (
          <button
            key={i.key}
            className={`cnae-tab${instrument === i.key ? " is-active" : ""}`}
            onClick={() => setInstrument(i.key)}
          >
            {i.label}
          </button>
        ))}
      </div>

      {err && <div className="cnae-note cnae-block--warn">{err}</div>}
      {msg && <div className="cnae-note cnae-note--ok">{msg}</div>}

      {/* Versão ativa */}
      <div className="cnae-card" style={{ marginBottom: 14 }}>
        <div className="cnae-card__hero">
          <strong style={{ fontSize: 15 }}>Versão ativa</strong>
          {active ? (
            <>
              <span className="cnae-badge cnae-badge--baixo">v{active.version} · ativa</span>
              <span className="cnae-muted">{active.label}</span>
            </>
          ) : (
            <span className="cnae-muted">Nenhuma versão ativa.</span>
          )}
        </div>
        {active && (
          <p className="cnae-muted" style={{ margin: "8px 0 0" }}>
            {active.dimensions.length} dimensões · {active.questions.length} perguntas · {active.bands.length} faixas
          </p>
        )}
        {!editing && (
          <div style={{ marginTop: 12 }}>
            <button className="btn btn--terra btn--sm" disabled={busy === "draft"} onClick={startDraft}>
              {busy === "draft" ? "Criando…" : "Criar rascunho para editar"}
            </button>
          </div>
        )}
      </div>

      {/* Editor do rascunho */}
      {editing && (
        <div className="cnae-card">
          <div className="cnae-card__hero" style={{ marginBottom: 12 }}>
            <span className="cnae-badge cnae-badge--medio">Rascunho</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Nome da versão"
              style={{ flex: 1, minWidth: 200, padding: "6px 10px", border: "1px solid var(--border,#e7e1d6)", borderRadius: 8, font: "inherit" }}
            />
          </div>

          {/* Dimensões */}
          <h4 className="meth-h">Dimensões</h4>
          <div className="meth-rows">
            {dims.map((d, i) => (
              <div className="meth-row" key={i}>
                <input className="meth-in meth-in--slug" value={d.slug} placeholder="slug" onChange={(e) => setDims(dims.map((x, j) => (j === i ? { ...x, slug: e.target.value } : x)))} />
                <input className="meth-in" value={d.label} placeholder="Rótulo da dimensão" onChange={(e) => setDims(dims.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                <input className="meth-in meth-in--num" type="number" step="0.1" value={d.weight} title="peso" onChange={(e) => setDims(dims.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value) } : x)))} />
                <button className="meth-del" title="Remover" onClick={() => setDims(dims.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
          </div>
          <button className="btn btn--ghost btn--sm" onClick={() => setDims([...dims, { slug: "", label: "", weight: 1 }])}>+ dimensão</button>

          {/* Perguntas */}
          <h4 className="meth-h" style={{ marginTop: 18 }}>Perguntas</h4>
          <div className="meth-rows">
            {questions.map((qq, i) => (
              <div className="meth-row" key={i}>
                <select className="meth-in meth-in--slug" value={qq.dimensionSlug} onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? { ...x, dimensionSlug: e.target.value } : x)))}>
                  <option value="">— dimensão —</option>
                  {dims.map((d) => (
                    <option key={d.slug} value={d.slug}>{d.slug || "(sem slug)"}</option>
                  ))}
                </select>
                <input className="meth-in" value={qq.text} placeholder="Texto da pergunta" onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
                <label className="meth-inv" title="Afirmação negativa (inverte a pontuação)">
                  <input type="checkbox" checked={qq.inverse} onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? { ...x, inverse: e.target.checked } : x)))} /> inv
                </label>
                <button className="meth-del" title="Remover" onClick={() => setQuestions(questions.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
          </div>
          <button className="btn btn--ghost btn--sm" onClick={() => setQuestions([...questions, { dimensionSlug: dims[0]?.slug ?? "", text: "", weight: 1, inverse: false }])}>+ pergunta</button>

          {/* Faixas */}
          <h4 className="meth-h" style={{ marginTop: 18 }}>{meta.bandWord}</h4>
          <div className="meth-rows">
            {bands.map((b, i) => (
              <div className="meth-row" key={i}>
                <input className="meth-in meth-in--slug" value={b.code} placeholder="código" onChange={(e) => setBands(bands.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)))} />
                <input className="meth-in" value={b.label} placeholder="Rótulo" onChange={(e) => setBands(bands.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                <input className="meth-in meth-in--num" type="number" min="0" max="100" value={b.min} title="mín" onChange={(e) => setBands(bands.map((x, j) => (j === i ? { ...x, min: Number(e.target.value) } : x)))} />
                <input className="meth-in meth-in--num" type="number" min="0" max="100" value={b.max} title="máx" onChange={(e) => setBands(bands.map((x, j) => (j === i ? { ...x, max: Number(e.target.value) } : x)))} />
                <button className="meth-del" title="Remover" onClick={() => setBands(bands.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
          </div>
          <button className="btn btn--ghost btn--sm" onClick={() => setBands([...bands, { kind: meta.bandKind, code: "", label: "", min: 0, max: 100 }])}>+ faixa</button>

          {/* Ações */}
          <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
            <button className="btn btn--outline-dark btn--sm" disabled={busy === "save"} onClick={save}>
              {busy === "save" ? "Salvando…" : "Salvar rascunho"}
            </button>
            <button className="btn btn--terra btn--sm" disabled={busy === "publish"} onClick={publish}>
              {busy === "publish" ? "Publicando…" : "Salvar e publicar"}
            </button>
            <button className="btn btn--ghost btn--sm" style={{ color: "var(--danger,#b4453a)" }} disabled={busy === "discard"} onClick={discard}>
              Descartar
            </button>
          </div>
        </div>
      )}

      {/* Histórico */}
      {versions.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <h4 className="meth-h">Histórico de versões</h4>
          <ul className="ct-list">
            {versions.map((v) => (
              <li key={v.id} className="ct-item">
                <div>
                  <strong>v{v.version}</strong> — {v.label}
                  <div className="ct-item__meta">
                    {v._count.dimensions} dim · {v._count.questions} perg · {v._count.bands} faixas
                    {v.publishedAt ? ` · publicada ${new Date(v.publishedAt).toLocaleDateString("pt-BR")}` : ""}
                  </div>
                </div>
                <span className={`cnae-badge cnae-badge--${v.status === "ACTIVE" ? "baixo" : v.status === "DRAFT" ? "medio" : "alto"}`}>
                  {v.status === "ACTIVE" ? "Ativa" : v.status === "DRAFT" ? "Rascunho" : "Arquivada"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
