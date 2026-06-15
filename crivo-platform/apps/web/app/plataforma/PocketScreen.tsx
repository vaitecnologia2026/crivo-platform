"use client";

import { useEffect, useMemo, useState } from "react";
import {
  POCKET_DIMENSION_FUNCTION,
  POCKET_DIMENSION_LABEL,
  POCKET_MOMENT_LABEL,
  POCKET_QUESTIONS,
  type PocketDimension,
  type PocketMomentOfUse,
  type PocketSessionData,
} from "@crivo/types";
import {
  completePocketSession,
  createPocketSession,
  getPocketSession,
  listMyPocketSessions,
  upsertPocketReflection,
} from "@/lib/api";

type Mode = { kind: "list" } | { kind: "session"; sessionId: string };

/**
 * Pocket CRIVO — Anexo Pocket §5, §11 ("mobile first, fluxo curto, perguntas por
 * blocos, salvar e retomar"). Linguagem de apoio, não de controle (§11).
 * Histórico individual; cada líder vê só o próprio (§13).
 */
export function PocketScreen() {
  const [mode, setMode] = useState<Mode>({ kind: "list" });

  return (
    <div className="pocket">
      {mode.kind === "list" ? (
        <PocketList onOpen={(id) => setMode({ kind: "session", sessionId: id })} />
      ) : (
        <PocketSession
          sessionId={mode.sessionId}
          onBack={() => setMode({ kind: "list" })}
        />
      )}
    </div>
  );
}

// ── Tela 1: lista do histórico + ação "Nova sessão" ────────────────────────

function PocketList({ onOpen }: { onOpen: (sessionId: string) => void }) {
  const [sessions, setSessions] = useState<PocketSessionData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newContext, setNewContext] = useState("");
  const [newMoment, setNewMoment] = useState<PocketMomentOfUse>("AVULSO");

  async function load() {
    try {
      setError(null);
      const list = await listMyPocketSessions();
      setSessions(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar sessões.");
    }
  }

  useEffect(() => {
    let alive = true;
    listMyPocketSessions()
      .then((list) => { if (alive) setSessions(list); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Falha ao carregar."); });
    return () => { alive = false; };
  }, []);

  async function startNew() {
    setCreating(true);
    try {
      const session = await createPocketSession({
        context: newContext.trim() || undefined,
        momentOfUse: newMoment,
      });
      setShowNewForm(false);
      setNewContext("");
      setNewMoment("AVULSO");
      onOpen(session.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível iniciar a sessão.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Pocket CRIVO</h1>
          <p className="page-sub">
            Vamos organizar esta decisão? Espaço de apoio à sua clareza e próximo passo.
          </p>
        </div>
        <div className="route__actions">
          {!showNewForm && (
            <button className="btn btn--gold btn--sm" onClick={() => setShowNewForm(true)}>
              + Nova sessão
            </button>
          )}
        </div>
      </div>

      {showNewForm && (
        <div className="card pocket-new">
          <h3>Nova reflexão</h3>
          <label className="pocket-field">
            <span>Contexto (opcional)</span>
            <input
              type="text"
              maxLength={400}
              placeholder="Ex.: reunião difícil, decisão de pessoas, conflito entre áreas…"
              value={newContext}
              onChange={(e) => setNewContext(e.target.value)}
            />
          </label>
          <label className="pocket-field">
            <span>Momento</span>
            <select value={newMoment} onChange={(e) => setNewMoment(e.target.value as PocketMomentOfUse)}>
              <option value="AVULSO">{POCKET_MOMENT_LABEL.AVULSO}</option>
              <option value="ANTES_DECISAO">{POCKET_MOMENT_LABEL.ANTES_DECISAO}</option>
              <option value="DURANTE_DECISAO">{POCKET_MOMENT_LABEL.DURANTE_DECISAO}</option>
            </select>
          </label>
          <div className="pocket-actions">
            <button className="btn btn--outline-dark btn--sm" onClick={() => setShowNewForm(false)} disabled={creating}>
              Cancelar
            </button>
            <button className="btn btn--gold btn--sm" onClick={startNew} disabled={creating}>
              {creating ? "Iniciando…" : "Começar"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="dash-state dash-state--error">
          {error}{" "}
          <button className="btn btn--outline-dark btn--sm" onClick={load}>Tentar de novo</button>
        </div>
      )}

      {sessions === null && !error && <p className="dash-state">Carregando…</p>}

      {sessions && sessions.length === 0 && !error && (
        <div className="card pocket-empty">
          <h3>Seu histórico está vazio</h3>
          <p className="card__sub">
            O Pocket apoia você antes ou durante decisões relevantes. Use poucos minutos
            para refletir nas 5 dimensões CRIVO — Consciência, Responsabilidade, Integração,
            Valores e Organização. <strong>Não é avaliação.</strong>
          </p>
        </div>
      )}

      {sessions && sessions.length > 0 && (
        <ul className="pocket-list">
          {sessions.map((s) => (
            <li key={s.id} className="card pocket-row" onClick={() => onOpen(s.id)}>
              <div className="pocket-row__top">
                <span className={`pill ${s.status === "CONCLUIDA" ? "pill--gold" : ""}`}>
                  {s.status === "CONCLUIDA" ? "Concluída" : "Em andamento"}
                </span>
                <span className="card__sub">{POCKET_MOMENT_LABEL[s.momentOfUse]}</span>
              </div>
              <h4>{s.context || "Reflexão sem contexto"}</h4>
              <div className="pocket-row__meta">
                <span>{s.reflections.length}/10 perguntas</span>
                <time>{new Date(s.createdAt).toLocaleString("pt-BR")}</time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// ── Tela 2: fluxo wizard 1 pergunta por vez ────────────────────────────────

function PocketSession({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
  const [session, setSession] = useState<PocketSessionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const total = POCKET_QUESTIONS.length;
  const current = POCKET_QUESTIONS[step] ?? null;
  const dimension = (current?.dimension ?? "C") as PocketDimension;

  /** Preenche o campo com a reflexão salva quando o step muda. */
  useEffect(() => {
    if (!session || !current) return;
    const existing = session.reflections.find((r) => r.questionCode === current.code);
    setText(existing?.text ?? "");
  }, [step, session, current]);

  useEffect(() => {
    let alive = true;
    getPocketSession(sessionId)
      .then((s) => {
        if (!alive) return;
        setSession(s);
        // Retoma na primeira pergunta sem reflexão.
        const firstEmpty = POCKET_QUESTIONS.findIndex(
          (q) => !s.reflections.find((r) => r.questionCode === q.code && (r.text?.length ?? 0) > 0),
        );
        setStep(firstEmpty === -1 ? 0 : firstEmpty);
      })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Falha ao carregar sessão."); });
    return () => { alive = false; };
  }, [sessionId]);

  const progress = useMemo(() => {
    if (!session) return 0;
    return Math.round((session.reflections.filter((r) => (r.text?.length ?? 0) > 0).length / total) * 100);
  }, [session, total]);

  async function save({ moveNext, complete }: { moveNext?: boolean; complete?: boolean }) {
    if (!current || !session) return;
    setSaving(true);
    try {
      const updated = await upsertPocketReflection(sessionId, {
        questionCode: current.code,
        text: text.trim() || undefined,
      });
      // Reflete localmente.
      const merged: PocketSessionData = {
        ...session,
        reflections: [
          ...session.reflections.filter((r) => r.questionCode !== current.code),
          updated,
        ],
      };
      setSession(merged);

      if (complete) {
        const finished = await completePocketSession(sessionId);
        setSession(finished);
        return;
      }
      if (moveNext) {
        setStep((s) => Math.min(s + 1, total - 1));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <div className="dash-state dash-state--error">
        {error}{" "}
        <button className="btn btn--outline-dark btn--sm" onClick={onBack}>Voltar</button>
      </div>
    );
  }

  if (!session) return <p className="dash-state">Carregando…</p>;

  const isCompleted = session.status === "CONCLUIDA";
  const onLast = step === total - 1;

  return (
    <>
      <div className="route__head">
        <button className="btn btn--ghost-dark btn--sm" onClick={onBack}>← Histórico</button>
        <div className="pocket-progress" aria-label={`Progresso ${progress}%`}>
          <div className="pocket-progress__bar" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {isCompleted ? (
        <div className="card pocket-done">
          <h2>Sessão concluída</h2>
          <p className="card__sub">
            Suas reflexões ficam salvas no seu histórico pessoal. Não são expostas
            individualmente para a empresa (§13).
          </p>
          <button className="btn btn--gold" onClick={onBack}>Voltar ao histórico</button>
        </div>
      ) : current ? (
        <div className="card pocket-card" data-dim={dimension}>
          <div className="pocket-card__head">
            <span className="pocket-tag">
              {current.code} · {POCKET_DIMENSION_LABEL[dimension]}
            </span>
            <span className="card__sub">{step + 1} de {total}</span>
          </div>
          <h2 className="pocket-question">{current.text}</h2>
          <p className="card__sub pocket-dim-fn">{POCKET_DIMENSION_FUNCTION[dimension]}</p>

          <textarea
            className="pocket-input"
            placeholder="Escreva o que vier — palavras, frases curtas, observações. Não há resposta certa."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            maxLength={2000}
          />

          <div className="pocket-actions">
            <button
              className="btn btn--outline-dark btn--sm"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || saving}
            >
              ← Anterior
            </button>
            {onLast ? (
              <button
                className="btn btn--gold btn--sm"
                onClick={() => save({ complete: true })}
                disabled={saving}
              >
                {saving ? "Salvando…" : "Concluir sessão"}
              </button>
            ) : (
              <button
                className="btn btn--gold btn--sm"
                onClick={() => save({ moveNext: true })}
                disabled={saving}
              >
                {saving ? "Salvando…" : "Próxima →"}
              </button>
            )}
          </div>

          {/* "salvar e retomar" §11 — registra sem avançar */}
          <button
            className="btn btn--ghost-dark btn--sm pocket-save-resume"
            onClick={() => save({})}
            disabled={saving || !text.trim()}
          >
            Salvar e continuar depois
          </button>
        </div>
      ) : null}
    </>
  );
}
