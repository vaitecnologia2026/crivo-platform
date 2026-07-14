"use client";

import { useEffect, useState } from "react";
import {
  createInstrument,
  createMethodologyDraft,
  deleteInstrument,
  deleteMethodologyDraft,
  ensureDiagnosticLink,
  getActiveMethodology,
  getDiagnosticResults,
  getMethodologyVersion,
  listDiagnosticLinks,
  listInstruments,
  listMethodologyVersions,
  listTenants,
  publishMethodology,
  updateMethodologyDraft,
  type DiagnosticLinkSummary,
  type InstrumentSummary,
  type MethodologyInstrument,
  type MethodologyVersion,
  type MethodologyVersionSummary,
  type ScoreAggregation,
} from "../../lib/admin-api";
import "./cnae.css";

// Fallback enquanto o catálogo carrega (os 2 built-in existem sempre).
const BUILTIN_TABS: InstrumentSummary[] = [
  { id: "b1", slug: "PRE_DIAGNOSTIC", name: "Diagnóstico Inicial (LP)", bandKind: "MATURITY", aggregation: "MEDIA_PONDERADA", description: null, active: true, builtIn: true },
  { id: "b2", slug: "PSYCHOSOCIAL", name: "Diagnóstico Organizacional", bandKind: "RISK", aggregation: "MEDIA_PONDERADA", description: null, active: true, builtIn: true },
];
const bandWordOf = (k: "MATURITY" | "RISK") => (k === "RISK" ? "Faixas de risco" : "Faixas de maturidade");
const AGG_LABEL: Record<ScoreAggregation, string> = {
  MEDIA_PONDERADA: "média ponderada",
  MEDIA_SIMPLES: "média simples",
  SOMA_NORMALIZADA: "soma normalizada",
};

type Dim = { slug: string; label: string; weight: number };
type Q = { dimensionSlug: string; text: string; weight: number; inverse: boolean };
type Band = { kind: "MATURITY" | "RISK"; code: string; label: string; min: number; max: number };

export function MethodologySection() {
  const [catalog, setCatalog] = useState<InstrumentSummary[]>(BUILTIN_TABS);
  const [instrument, setInstrument] = useState<MethodologyInstrument>("PSYCHOSOCIAL");
  const [newOpen, setNewOpen] = useState(false);
  const inst = catalog.find((i) => i.slug === instrument) ?? BUILTIN_TABS[1];
  const meta = { label: inst.name, bandKind: inst.bandKind, bandWord: bandWordOf(inst.bandKind) };

  async function refreshCatalog() {
    try {
      const list = await listInstruments();
      if (list.length > 0) setCatalog(list);
    } catch { /* mantém fallback built-in */ }
  }
  useEffect(() => { void refreshCatalog(); }, []);
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
  const [demoOpen, setDemoOpen] = useState(false);
  const [contentOpen, setContentOpen] = useState(false); // conteúdo da versão ATIVA (inline)
  const [viewVersion, setViewVersion] = useState<MethodologyVersion | null>(null); // versão do histórico (modal)

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

      <div className="cnae-tabs" style={{ marginBottom: 14, flexWrap: "wrap" }}>
        {catalog.filter((i) => i.active).map((i) => (
          <button
            key={i.slug}
            className={`cnae-tab${instrument === i.slug ? " is-active" : ""}`}
            onClick={() => setInstrument(i.slug)}
          >
            {i.name}
          </button>
        ))}
        <button className="cnae-tab meth-newtab" onClick={() => setNewOpen(true)}>
          + Novo diagnóstico
        </button>
      </div>

      {!inst.builtIn && (
        <p className="cnae-muted" style={{ marginTop: -6 }}>
          Diagnóstico personalizado · régua de {meta.bandWord.toLowerCase().replace("faixas de ", "")} · cálculo por {AGG_LABEL[inst.aggregation]} ·{" "}
          <button
            type="button"
            className="meth-inline-del"
            onClick={async () => {
              if (!window.confirm(`Remover o diagnóstico "${inst.name}"? Com versões existentes ele é apenas desativado.`)) return;
              try {
                await deleteInstrument(inst.slug);
                setInstrument("PSYCHOSOCIAL");
                await refreshCatalog();
              } catch (e) { setErr(e instanceof Error ? e.message : "Falha ao remover."); }
            }}
          >
            remover
          </button>
        </p>
      )}

      {newOpen && (
        <NewInstrumentModal
          onClose={() => setNewOpen(false)}
          onCreated={async (slug) => {
            setNewOpen(false);
            await refreshCatalog();
            setInstrument(slug);
            setMsg("Diagnóstico criado. Crie um rascunho, cadastre dimensões/perguntas/faixas e publique.");
          }}
        />
      )}

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
        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {active && (
            <button className="btn btn--outline-dark btn--sm" onClick={() => setContentOpen((v) => !v)}>
              {contentOpen ? "Ocultar conteúdo" : "Ver conteúdo da versão"}
            </button>
          )}
          {active && (
            <button className="btn btn--outline-dark btn--sm" onClick={() => setDemoOpen(true)}>
              Ver demo do instrumento
            </button>
          )}
          {!editing && (
            <button className="btn btn--terra btn--sm" disabled={busy === "draft"} onClick={startDraft}>
              {busy === "draft" ? "Criando…" : "Criar rascunho para editar"}
            </button>
          )}
        </div>

        {/* Conteúdo da versão ATIVA + memória de cálculo (leitura) */}
        {contentOpen && active && <VersionContent version={active} bandWord={meta.bandWord} />}
      </div>

      {/* Aplicação (motor dinâmico): link público /d/<slug> por empresa */}
      {!inst.builtIn && active && <ApplicationPanel instrumentSlug={inst.slug} />}

      {demoOpen && active && (
        <InstrumentDemo version={active} instrumentLabel={meta.label} onClose={() => setDemoOpen(false)} />
      )}

      {/* Conteúdo de uma versão do HISTÓRICO (modal) */}
      {viewVersion && (
        <div className="modal-backdrop" onClick={() => setViewVersion(null)}>
          <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
            <header className="modal__head">
              <h2>
                v{viewVersion.version} — {viewVersion.label}
              </h2>
              <button className="icon-btn" onClick={() => setViewVersion(null)} title="Fechar">✕</button>
            </header>
            <div className="modal__body">
              <VersionContent version={viewVersion} bandWord={meta.bandWord} />
            </div>
            <div className="modal__foot">
              <button type="button" className="btn btn--outline-dark btn--sm" onClick={() => setViewVersion(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

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
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={async () => {
                      try { setViewVersion(await getMethodologyVersion(v.id)); }
                      catch { setErr("Não foi possível abrir esta versão."); }
                    }}
                  >
                    Ver conteúdo
                  </button>
                  <span className={`cnae-badge cnae-badge--${v.status === "ACTIVE" ? "baixo" : v.status === "DRAFT" ? "medio" : "alto"}`}>
                    {v.status === "ACTIVE" ? "Ativa" : v.status === "DRAFT" ? "Rascunho" : "Arquivada"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Conteúdo READ-ONLY de uma versão da metodologia: memória de cálculo (como a
 * versão pontua, derivada da config real) + dimensões→perguntas + faixas.
 * Pedido do cliente (call 14/07): "consigo cadastrar, mas preciso VER o que
 * tem lá dentro" + "onde vejo a memória de cálculo".
 */
function VersionContent({ version, bandWord }: { version: MethodologyVersion; bandWord: string }) {
  const hasCustomWeights =
    version.dimensions.some((d) => d.weight !== 1) || version.questions.some((q) => q.weight !== 1);
  const invertidas = version.questions.filter((q) => q.inverse).length;
  return (
    <div className="meth-view">
      <div className="meth-view__calc">
        <span className="meth-view__title">Memória de cálculo — como esta versão pontua</span>
        <ol>
          <li>Cada resposta usa escala de 5 pontos, normalizada para 0–100.</li>
          <li>
            {invertidas > 0
              ? `${invertidas} pergunta(s) invertida(s): afirmação negativa espelha a pontuação (100 − valor).`
              : "Nenhuma pergunta invertida nesta versão."}
          </li>
          <li>
            Score da dimensão = média {hasCustomWeights ? "PONDERADA (pesos abaixo)" : "das perguntas (pesos iguais)"}.
          </li>
          <li>
            Score final = média {hasCustomWeights ? "ponderada" : ""} das dimensões, aplicada na régua de{" "}
            {bandWord.toLowerCase()}.
          </li>
          <li>O resultado fica sempre entre 0 e 100 — não existe pontuação negativa.</li>
        </ol>
      </div>

      {version.dimensions.map((d) => {
        const qs = version.questions.filter((q) => q.dimensionSlug === d.slug);
        return (
          <div key={d.slug} className="meth-view__dim">
            <div className="meth-view__dimhead">
              <strong>{d.label}</strong>
              <em>peso {d.weight} · {qs.length} pergunta(s)</em>
            </div>
            <ul>
              {qs.map((q, i) => (
                <li key={i}>
                  {q.text}
                  <span className="meth-view__qmeta">
                    peso {q.weight}
                    {q.inverse ? " · invertida" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <div className="meth-view__bands">
        <span className="meth-view__title">{bandWord}</span>
        <table>
          <thead>
            <tr><th>Faixa</th><th>Rótulo</th><th>Intervalo</th></tr>
          </thead>
          <tbody>
            {version.bands.map((b) => (
              <tr key={b.code}>
                <td><code>{b.code}</code></td>
                <td>{b.label}</td>
                <td>{b.min}–{b.max}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* Escala Likert genérica da demo (0–4 → 0–100). */
const DEMO_SCALE = [
  { value: 0, label: "Discordo totalmente" },
  { value: 1, label: "Discordo" },
  { value: 2, label: "Neutro" },
  { value: 3, label: "Concordo" },
  { value: 4, label: "Concordo totalmente" },
];

/**
 * Demo interativa do instrumento — mostra a versão ATIVA como o respondente vê
 * e calcula uma pontuação ilustrativa pela régua (faixas) publicada.
 * NADA é gravado: é uma simulação local para o super admin conferir o motor.
 */
function InstrumentDemo({
  version,
  instrumentLabel,
  onClose,
}: {
  version: MethodologyVersion;
  instrumentLabel: string;
  onClose: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{
    score: number;
    band: { label: string; code: string } | null;
    byDim: { label: string; score: number; detail: string }[];
    finalDetail: string;
  } | null>(null);

  const total = version.questions.length;
  const answered = Object.keys(answers).length;

  function calc() {
    // Pontuação 0–100: média ponderada das perguntas (inverse espelha a escala).
    let sum = 0;
    let wsum = 0;
    const dimAcc = new Map<string, { sum: number; wsum: number }>();
    version.questions.forEach((q, i) => {
      const raw = answers[String(i)];
      if (raw === undefined) return;
      const norm = (raw / 4) * 100;
      const val = q.inverse ? 100 - norm : norm;
      const w = q.weight || 1;
      sum += val * w;
      wsum += w;
      const acc = dimAcc.get(q.dimensionSlug) ?? { sum: 0, wsum: 0 };
      acc.sum += val * w;
      acc.wsum += w;
      dimAcc.set(q.dimensionSlug, acc);
    });
    const score = Math.max(0, Math.min(100, wsum > 0 ? Math.round(sum / wsum) : 0));
    const band = version.bands.find((b) => score >= b.min && score <= b.max) ?? null;
    const byDim = version.dimensions.map((d) => {
      const acc = dimAcc.get(d.slug);
      const dimScore = acc && acc.wsum > 0 ? Math.max(0, Math.min(100, Math.round(acc.sum / acc.wsum))) : 0;
      const detail = acc && acc.wsum > 0
        ? `Σ(resposta normalizada × peso) ÷ Σ(pesos) = ${Math.round(acc.sum)} ÷ ${acc.wsum} = ${dimScore}`
        : "sem respostas";
      return { label: d.label, score: dimScore, detail };
    });
    const finalDetail = `média ponderada das respostas = ${Math.round(sum)} ÷ ${wsum} = ${score} → faixa ${band ? band.label : "—"}`;
    setResult({ score, band: band ? { label: band.label, code: band.code } : null, byDim, finalDetail });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <h2>Demo — {instrumentLabel}</h2>
          <button className="icon-btn" onClick={onClose} title="Fechar">✕</button>
        </header>

        <div className="modal__body">
          <p className="cnae-muted" style={{ marginTop: 0 }}>
            Simulação da versão ativa <strong>v{version.version} · {version.label}</strong> como o respondente vê.
            Nada é gravado — a pontuação é ilustrativa, calculada pela régua publicada.
          </p>

          {version.dimensions.map((d) => {
            const qs = version.questions
              .map((q, i) => ({ q, i }))
              .filter(({ q }) => q.dimensionSlug === d.slug);
            if (qs.length === 0) return null;
            return (
              <div key={d.slug} className="demo-dim">
                <h4 className="meth-h">{d.label}</h4>
                {qs.map(({ q, i }) => (
                  <div key={i} className="demo-q">
                    <p>{q.text}</p>
                    <div className="demo-opts">
                      {DEMO_SCALE.map((o) => (
                        <label key={o.value} className={answers[String(i)] === o.value ? "is-active" : ""}>
                          <input
                            type="radio"
                            name={`demo-q-${i}`}
                            checked={answers[String(i)] === o.value}
                            onChange={() => setAnswers((a) => ({ ...a, [String(i)]: o.value }))}
                          />
                          {o.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          {result && (
            <div className="demo-result">
              <div className="demo-result__score">
                <strong>{result.score}</strong>
                <span>/ 100</span>
                {result.band && <em>{result.band.label}</em>}
              </div>
              <p className="demo-result__formula">{result.finalDetail}</p>
              <div className="demo-result__dims">
                {result.byDim.map((d) => (
                  <div key={d.label} className="demo-result__dim" title={d.detail}>
                    <span>{d.label}</span>
                    <div className="demo-bar"><i style={{ width: `${d.score}%` }} /></div>
                    <b>{d.score}</b>
                  </div>
                ))}
              </div>
              <p className="demo-result__hint">Passe o mouse numa dimensão para ver a memória de cálculo dela.</p>
            </div>
          )}
        </div>

        <div className="modal__foot">
          <span className="cnae-muted" style={{ marginRight: "auto" }}>
            {answered}/{total} respondidas
          </span>
          <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>Fechar</button>
          <button type="button" className="btn btn--terra btn--sm" disabled={answered === 0} onClick={calc}>
            Calcular resultado
          </button>
        </div>
      </div>
    </div>
  );
}

/** Modal de criação de diagnóstico (motor dinâmico — call 14/07). */
function NewInstrumentModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (slug: string) => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [bandKind, setBandKind] = useState<"MATURITY" | "RISK">("MATURITY");
  const [aggregation, setAggregation] = useState<ScoreAggregation>("MEDIA_PONDERADA");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slugify = (v: string) =>
    v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const finalSlug = slug || slugify(name);
      await createInstrument({ slug: finalSlug, name: name.trim(), bandKind, aggregation, description: description.trim() || null });
      await onCreated(finalSlug);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar o diagnóstico.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <h2>Novo diagnóstico</h2>
          <button className="icon-btn" onClick={onClose} title="Fechar">✕</button>
        </header>
        <form onSubmit={submit} className="modal__body prod-form">
          <div className="prod-form__grid">
            <label className="prod-field prod-field--full">
              <span>Nome do diagnóstico</span>
              <input
                value={name}
                required
                placeholder="Ex.: Clima Organizacional, Prontidão de IA"
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugTouched) setSlug(slugify(e.target.value));
                }}
              />
            </label>
            <label className="prod-field prod-field--full">
              <span>Slug (URL/identificador — minúsculas e hífen)</span>
              <input
                value={slug}
                required
                pattern="[a-z0-9][a-z0-9-]{2,39}"
                onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }}
              />
            </label>
            <label className="prod-field">
              <span>Tipo de régua</span>
              <select value={bandKind} onChange={(e) => setBandKind(e.target.value as "MATURITY" | "RISK")}>
                <option value="MATURITY">Maturidade (maior = melhor)</option>
                <option value="RISK">Risco (maior = menor risco)</option>
              </select>
            </label>
            <label className="prod-field">
              <span>Memória de cálculo</span>
              <select value={aggregation} onChange={(e) => setAggregation(e.target.value as ScoreAggregation)}>
                <option value="MEDIA_PONDERADA">Média ponderada (pesos)</option>
                <option value="MEDIA_SIMPLES">Média simples</option>
                <option value="SOMA_NORMALIZADA">Soma normalizada (% do máximo)</option>
              </select>
            </label>
            <label className="prod-field prod-field--full">
              <span>Descrição (opcional)</span>
              <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
          </div>
          {error && <p className="prod-note" style={{ color: "var(--danger, #b4453a)" }}>{error}</p>}
          <p className="prod-note">
            Depois de criar: abra a aba do diagnóstico, crie um rascunho, cadastre dimensões, perguntas e faixas e
            publique. A aplicação gera um link público por empresa (Aplicação).
          </p>
          <div className="modal__foot">
            <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn--terra btn--sm" disabled={saving || !name.trim()}>
              {saving ? "Criando…" : "Criar diagnóstico"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Aplicação de um diagnóstico dinâmico: gera o link público /d/<slug> por
 * empresa, lista respondentes e mostra o agregado (com supressão <5).
 */
function ApplicationPanel({ instrumentSlug }: { instrumentSlug: string }) {
  const [links, setLinks] = useState<DiagnosticLinkSummary[]>([]);
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [results, setResults] = useState<{ tenantName: string; data: Awaited<ReturnType<typeof getDiagnosticResults>> } | null>(null);

  async function refresh() {
    try { setLinks(await listDiagnosticLinks(instrumentSlug)); } catch { /* silencioso */ }
  }
  useEffect(() => {
    void refresh();
    listTenants().then((ts) => setTenants(ts.map((t) => ({ id: t.id, name: t.name })))).catch(() => setTenants([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instrumentSlug]);

  async function generate() {
    if (!tenantId) return;
    setBusy(true);
    setError(null);
    try {
      await ensureDiagnosticLink(tenantId, instrumentSlug);
      setTenantId("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao gerar o link.");
    } finally {
      setBusy(false);
    }
  }

  const urlOf = (slug: string) => `${window.location.origin}/d/${slug}`;

  return (
    <div className="cnae-card" style={{ marginBottom: 14 }}>
      <div className="cnae-card__hero">
        <strong style={{ fontSize: 15 }}>Aplicação</strong>
        <span className="cnae-muted">link público anônimo por empresa · agregado a partir de 5 respostas</span>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <select
          className="mod-select"
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          aria-label="Empresa para gerar o link"
        >
          <option value="">— escolha a empresa —</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <button className="btn btn--terra btn--sm" disabled={busy || !tenantId} onClick={generate}>
          {busy ? "Gerando…" : "Gerar link de aplicação"}
        </button>
      </div>
      {error && <p className="cnae-note cnae-block--warn" style={{ marginTop: 10 }}>{error}</p>}

      {links.length > 0 && (
        <ul className="ct-list" style={{ marginTop: 14 }}>
          {links.map((l) => (
            <li key={l.id} className="ct-item">
              <div style={{ minWidth: 0 }}>
                <strong>{l.tenantName}</strong>
                <div className="ct-item__meta" style={{ wordBreak: "break-all" }}>
                  /d/{l.slug} · {l.respondents} resposta(s)
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(urlOf(l.slug));
                    setCopied(l.id);
                    setTimeout(() => setCopied(null), 1500);
                  }}
                >
                  {copied === l.id ? "Copiado" : "Copiar link"}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={async () => {
                    try {
                      setResults({ tenantName: l.tenantName, data: await getDiagnosticResults(l.tenantId, instrumentSlug) });
                    } catch { setError("Não foi possível carregar o agregado."); }
                  }}
                >
                  Ver agregado
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {links.length === 0 && (
        <p className="cnae-muted" style={{ marginTop: 12 }}>
          Nenhum link gerado ainda. Escolha uma empresa e gere o link para aplicar este diagnóstico.
        </p>
      )}

      {results && (
        <div className="demo-result" style={{ marginTop: 14 }}>
          <div className="cnae-card__hero" style={{ marginBottom: 8 }}>
            <strong>{results.tenantName}</strong>
            <span className="cnae-muted">
              {results.data.totalRespondents} resposta(s) · mínimo p/ divulgar: {results.data.minRespondents}
            </span>
          </div>
          {results.data.suppressed ? (
            <p className="cnae-muted" style={{ margin: 0 }}>
              Agregado suprimido — ainda não há {results.data.minRespondents} respostas (proteção de anonimato).
            </p>
          ) : (
            <>
              <div className="demo-result__score">
                <strong>{results.data.score}</strong>
                <span>/ 100</span>
                <em>{results.data.levelLabel || results.data.level}</em>
              </div>
              <div className="demo-result__dims">
                {Object.entries(results.data.byDimension ?? {}).map(([slug, v]) => (
                  <div key={slug} className="demo-result__dim">
                    <span>{results.data.dimensionLabels?.[slug] ?? slug}</span>
                    <div className="demo-bar"><i style={{ width: `${v}%` }} /></div>
                    <b>{v}</b>
                  </div>
                ))}
              </div>
              {results.data.methodologyMixed && (
                <p className="demo-result__hint">
                  Atenção: as respostas foram pontuadas por versões diferentes da metodologia (comparabilidade limitada).
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
