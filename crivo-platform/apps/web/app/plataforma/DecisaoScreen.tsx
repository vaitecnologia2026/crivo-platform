"use client";

import { useEffect, useMemo, useState } from "react";
import {
  listDecisions,
  createDecision,
  listDecisionCategories,
  listDecisionAudiences,
  submitDecisionIcd,
} from "@/lib/api";
import {
  DECISION_IMPACTS,
  DECISION_IMPACT_LABEL,
  DECISION_TYPES,
  DECISION_TYPE_LABEL,
  DECISION_POCKET_USES,
  DECISION_POCKET_USE_LABEL,
  DECISION_PRESSURE_FACTORS,
  DECISION_PRESSURE_FACTOR_LABEL,
  DECISION_REVISION_PERIODS,
  DECISION_REVISION_PERIOD_LABEL,
  ICD_AXES,
  ICD_AXIS_LABEL,
  ICD_AXIS_DESCRIPTION,
  ICD_AXIS_SCALE,
  ICD_AXIS_QUESTIONS,
  type DecisionData,
  type DecisionInput,
  type DecisionCategory,
  type AffectedAudience,
  type DecisionIcdData,
  type DecisionStatus,
} from "@crivo/types";
import { IconCheck, IconClose } from "./Icons";

type LoadStatus = "loading" | "error" | "ok";

const STATUS_LABEL: Record<DecisionStatus, string> = {
  EM_REGISTRO: "Em registro",
  REGISTRADA: "Registrada",
  AVALIADA_PELO_ICD: "Avaliada pelo ICD",
};

function scoreClass(v: number): string {
  return v >= 80 ? "is-high" : v >= 60 ? "is-mid" : "is-low";
}

function todayISODate(): string {
  // value de <input type="date"> é YYYY-MM-DD; usamos só a parte da data.
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function DecisaoScreen() {
  const [decisions, setDecisions] = useState<DecisionData[] | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [categories, setCategories] = useState<DecisionCategory[]>([]);
  const [audiences, setAudiences] = useState<AffectedAudience[]>([]);
  const [creating, setCreating] = useState(false);

  async function refresh() {
    try {
      const d = await listDecisions();
      setDecisions(d);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    void refresh();
    listDecisionCategories().then(setCategories).catch(() => setCategories([]));
    listDecisionAudiences().then(setAudiences).catch(() => setAudiences([]));
  }, []);

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Registro de Decisões</h1>
          <p className="page-sub">
            Registre as decisões reais que você toma. Cada decisão pode ser avaliada pelo ICD (4 Eixos) — é o que
            alimenta o Índice de Coerência da liderança no Dashboard.
          </p>
        </div>
        <button className="btn btn--terra btn--sm" onClick={() => setCreating(true)}>
          + Nova decisão
        </button>
      </div>

      {status === "loading" && <p className="dash-state">Carregando suas decisões…</p>}
      {status === "error" && (
        <div className="dash-state dash-state--error">
          Não foi possível carregar.
          <button className="btn btn--outline-dark btn--sm" onClick={() => void refresh()}>
            Tentar novamente
          </button>
        </div>
      )}

      {status === "ok" && decisions && decisions.length === 0 && (
        <div className="dash-state" style={{ margin: 0 }}>
          Nenhuma decisão registrada ainda. Comece em <strong>“+ Nova decisão”</strong> — depois avalie pelo ICD para
          ver seus 4 Eixos.
        </div>
      )}

      {status === "ok" &&
        decisions &&
        decisions.map((d) => <DecisaoCard key={d.id} decisao={d} onChanged={() => void refresh()} />)}

      {creating && (
        <NovaDecisaoModal
          categories={categories}
          audiences={audiences}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void refresh();
          }}
        />
      )}
    </>
  );
}

// ─────────────────────────── Card de decisão ───────────────────────────

function DecisaoCard({ decisao, onChanged }: { decisao: DecisionData; onChanged: () => void }) {
  const [avaliando, setAvaliando] = useState(false);
  const [icd, setIcd] = useState<DecisionIcdData | null>(null);
  const avaliada = decisao.status === "AVALIADA_PELO_ICD";

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card__head">
        <div>
          <h3>{decisao.title}</h3>
          <span className="card__sub">{decisao.description}</span>
        </div>
        <span className="pattern-tag">{STATUS_LABEL[decisao.status]}</span>
      </div>

      <div className="dash-dist" style={{ marginBottom: 12 }}>
        {decisao.category && <span className="dash-dist__item">Categoria: <strong>{decisao.category.name}</strong></span>}
        <span className="dash-dist__item">Impacto: <strong>{DECISION_IMPACT_LABEL[decisao.impact]}</strong></span>
        <span className="dash-dist__item">Tipo: <strong>{DECISION_TYPE_LABEL[decisao.type]}</strong></span>
        <span className="dash-dist__item">
          Decidida em: <strong>{new Date(decisao.decidedAt).toLocaleDateString("pt-BR")}</strong>
        </span>
      </div>

      {(icd ?? null) && <IcdResultado icd={icd!} />}

      {!avaliada && !icd && (
        <button className="btn btn--gold btn--sm" onClick={() => setAvaliando((v) => !v)}>
          {avaliando ? "Fechar avaliação" : "Avaliar pelo ICD (4 Eixos)"}
        </button>
      )}
      {avaliada && !icd && (
        <p className="card__sub" style={{ margin: 0 }}>
          ✓ Esta decisão já foi avaliada e compõe o ICD oficial do ciclo.
        </p>
      )}

      {avaliando && !icd && (
        <IcdAvaliacao
          decisionId={decisao.id}
          onCancel={() => setAvaliando(false)}
          onDone={(result) => {
            setIcd(result);
            setAvaliando(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function IcdResultado({ icd }: { icd: DecisionIcdData }) {
  return (
    <div className="eixos-official" style={{ marginTop: 4 }}>
      <div className="eixos-official__head">
        <div className="eixos-official__score">
          <strong className={`dash-score ${scoreClass(icd.score)}`}>{icd.score}</strong>
          <span>ICD desta decisão</span>
        </div>
      </div>
      <div className="eixos-grid">
        {ICD_AXES.map((ax) => {
          const v = Math.round(icd.axes[ax] ?? 0);
          return (
            <div className="eixo" key={ax} title={ICD_AXIS_DESCRIPTION[ax]}>
              <div className="eixo__top">
                <span className="eixo__label">{ICD_AXIS_LABEL[ax]}</span>
                <strong className={`dash-score ${scoreClass(v)}`}>{v}</strong>
              </div>
              <div className="eixo__bar">
                <span className={`eixo__fill ${scoreClass(v)}`} style={{ width: `${v}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────── Avaliação ICD (8 afirmações) ───────────────────

function IcdAvaliacao({
  decisionId,
  onCancel,
  onDone,
}: {
  decisionId: string;
  onCancel: () => void;
  onDone: (result: DecisionIcdData) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allAnswered = ICD_AXIS_QUESTIONS.every((q) => answers[q.id] != null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const payload = ICD_AXIS_QUESTIONS.map((q) => ({ id: q.id, value: answers[q.id] }));
      const result = await submitDecisionIcd(decisionId, payload);
      onDone(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar a avaliação.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="icd-aval">
      <p className="card__sub" style={{ marginTop: 0 }}>
        Responda às 8 afirmações sobre <strong>esta decisão</strong> (1 = discordo totalmente · 5 = concordo
        totalmente). Os 4 Eixos são calculados automaticamente.
      </p>
      {ICD_AXIS_QUESTIONS.map((q, i) => (
        <div className="icd-aval__q" key={q.id}>
          <span className="icd-aval__qhead">
            <em>{ICD_AXIS_LABEL[q.axis]}</em>
            {i + 1}. {q.text}
          </span>
          <div className="icd-aval__scale">
            {ICD_AXIS_SCALE.map((s) => (
              <button
                type="button"
                key={s.value}
                className={`icd-aval__opt${answers[q.id] === s.value ? " is-on" : ""}`}
                onClick={() => setAnswers((a) => ({ ...a, [q.id]: s.value }))}
                title={s.label}
              >
                {s.value}
              </button>
            ))}
          </div>
        </div>
      ))}
      <p className="card__sub" style={{ fontSize: 11 }}>
        1 {ICD_AXIS_SCALE[0].label} · 5 {ICD_AXIS_SCALE[4].label}
      </p>
      {error && <p className="dash-state dash-state--error" style={{ margin: "6px 0" }}>{error}</p>}
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn btn--outline-dark btn--sm" type="button" onClick={onCancel}>
          Cancelar
        </button>
        <button className="btn btn--gold btn--sm" type="button" disabled={!allAnswered || saving} onClick={() => void submit()}>
          {saving ? "Calculando…" : "Calcular ICD da decisão"}
        </button>
      </div>
    </div>
  );
}

// ───────────────────────── Modal: nova decisão ─────────────────────────

function NovaDecisaoModal({
  categories,
  audiences,
  onClose,
  onCreated,
}: {
  categories: DecisionCategory[];
  audiences: AffectedAudience[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [f, setF] = useState({
    title: "",
    description: "",
    categoryId: "",
    impact: "MEDIO" as DecisionInput["impact"],
    type: "INDIVIDUAL" as DecisionInput["type"],
    pocketUse: "NAO_UTILIZADO" as DecisionInput["pocketUse"],
    pressureFactor: "URGENCIA" as DecisionInput["pressureFactor"],
    revisionPeriod: "SEM_REVISAO" as DecisionInput["revisionPeriod"],
    decidedAt: todayISODate(),
  });
  const [audienceIds, setAudienceIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = f.title.trim().length >= 3 && f.description.trim().length >= 10;

  function toggleAudience(id: string) {
    setAudienceIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      const dto: DecisionInput = {
        title: f.title.trim(),
        description: f.description.trim(),
        categoryId: f.categoryId || null,
        impact: f.impact,
        type: f.type,
        pocketUse: f.pocketUse,
        pressureFactor: f.pressureFactor,
        revisionPeriod: f.revisionPeriod,
        decidedAt: new Date(f.decidedAt + "T12:00:00").toISOString(),
        audienceIds,
      };
      await createDecision(dto);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao registrar a decisão.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <div>
            <span className="card__eyebrow">Registro de Decisão</span>
            <h2 style={{ marginTop: 4 }}>Nova decisão</h2>
          </div>
          <button className="icon-btn" onClick={onClose} title="Fechar" type="button">
            <IconClose size={16} />
          </button>
        </header>
        <form onSubmit={submit} className="modal__body prod-form">
          <div className="prod-form__grid">
            <label className="prod-field prod-field--full">
              <span>Título da decisão *</span>
              <input
                value={f.title}
                onChange={(e) => setF({ ...f, title: e.target.value })}
                placeholder="Ex.: Reestruturar a escala do turno noturno"
                maxLength={240}
                required
              />
            </label>
            <label className="prod-field prod-field--full">
              <span>Contexto / descrição *</span>
              <textarea
                value={f.description}
                onChange={(e) => setF({ ...f, description: e.target.value })}
                placeholder="O que estava em jogo, quais pressões, quem foi afetado…"
                rows={4}
                maxLength={4000}
                required
              />
            </label>
            <label className="prod-field">
              <span>Categoria</span>
              <select value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
                <option value="">— Sem categoria —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="prod-field">
              <span>Data da decisão *</span>
              <input type="date" value={f.decidedAt} onChange={(e) => setF({ ...f, decidedAt: e.target.value })} required />
            </label>
            <label className="prod-field">
              <span>Impacto *</span>
              <select value={f.impact} onChange={(e) => setF({ ...f, impact: e.target.value as DecisionInput["impact"] })}>
                {DECISION_IMPACTS.map((v) => (
                  <option key={v} value={v}>{DECISION_IMPACT_LABEL[v]}</option>
                ))}
              </select>
            </label>
            <label className="prod-field">
              <span>Natureza *</span>
              <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as DecisionInput["type"] })}>
                {DECISION_TYPES.map((v) => (
                  <option key={v} value={v}>{DECISION_TYPE_LABEL[v]}</option>
                ))}
              </select>
            </label>
            <label className="prod-field">
              <span>Fator de pressão dominante *</span>
              <select
                value={f.pressureFactor}
                onChange={(e) => setF({ ...f, pressureFactor: e.target.value as DecisionInput["pressureFactor"] })}
              >
                {DECISION_PRESSURE_FACTORS.map((v) => (
                  <option key={v} value={v}>{DECISION_PRESSURE_FACTOR_LABEL[v]}</option>
                ))}
              </select>
            </label>
            <label className="prod-field">
              <span>Usou o Pocket CRIVO? *</span>
              <select value={f.pocketUse} onChange={(e) => setF({ ...f, pocketUse: e.target.value as DecisionInput["pocketUse"] })}>
                {DECISION_POCKET_USES.map((v) => (
                  <option key={v} value={v}>{DECISION_POCKET_USE_LABEL[v]}</option>
                ))}
              </select>
            </label>
            <label className="prod-field">
              <span>Revisão prevista *</span>
              <select
                value={f.revisionPeriod}
                onChange={(e) => setF({ ...f, revisionPeriod: e.target.value as DecisionInput["revisionPeriod"] })}
              >
                {DECISION_REVISION_PERIODS.map((v) => (
                  <option key={v} value={v}>{DECISION_REVISION_PERIOD_LABEL[v]}</option>
                ))}
              </select>
            </label>
            {audiences.length > 0 && (
              <div className="prod-field prod-field--full">
                <span>Públicos afetados</span>
                <div className="dec-aud">
                  {audiences.map((a) => (
                    <button
                      type="button"
                      key={a.id}
                      className={`dec-aud__chip${audienceIds.includes(a.id) ? " is-on" : ""}`}
                      onClick={() => toggleAudience(a.id)}
                    >
                      {audienceIds.includes(a.id) && <IconCheck size={12} />} {a.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {error && <p className="dash-state dash-state--error" style={{ margin: "4px 0 0" }}>{error}</p>}
        </form>
        <div className="modal__foot">
          <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn--terra btn--sm" disabled={!valid || saving} onClick={(e) => void submit(e as unknown as React.FormEvent)}>
            {saving ? "Registrando…" : "Registrar decisão"}
          </button>
        </div>
      </div>
    </div>
  );
}
