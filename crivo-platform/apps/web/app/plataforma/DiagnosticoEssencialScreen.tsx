"use client";

import { useEffect, useState } from "react";
import {
  ESSENTIAL_RECORD_LABEL,
  MATURITY_LABEL,
  PRE_DIAGNOSTIC_DIMENSION_LABEL,
  PRE_DIAGNOSTIC_DIMENSIONS,
  PRE_DIAGNOSTIC_QUESTIONS,
  PRE_DIAGNOSTIC_SCALE,
  type EssentialRecordData,
  type EssentialRecordKind,
  type SelfAssessmentData,
} from "@crivo/types";
import { publicOrigin } from "@/lib/share-url";
import {
  createEssentialRecord,
  ensurePsychosocialLink,
  getDiagnosticContext,
  getPsychosocialLink,
  getSelfAssessment,
  listEssentialRecords,
  submitSelfAssessment,
} from "@/lib/api";
import { ScaleHelpBox } from "@crivo/ui";

/** Diagnóstico Essencial (Briefing §5): autoavaliação + escuta/observação → Plano de Ação. */
export function DiagnosticoEssencialScreen() {
  const [assessment, setAssessment] = useState<SelfAssessmentData | null>(null);
  const [records, setRecords] = useState<EssentialRecordData[]>([]);
  const [method, setMethod] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ok">("loading");

  async function refresh() {
    const [a, r, ctx] = await Promise.all([
      getSelfAssessment(),
      listEssentialRecords(),
      getDiagnosticContext().catch(() => null),
    ]);
    setAssessment(a);
    setRecords(r);
    setMethod(ctx?.method ?? null);
    setStatus("ok");
  }
  useEffect(() => { void refresh().catch(() => setStatus("ok")); }, []);

  // #8/#10 — o título e a chamada se moldam ao tipo do produto do cliente.
  const isOrg = method === "ORGANIZACIONAL";
  const heading = isOrg
    ? "Diagnóstico Organizacional"
    : method === "ESSENCIAL"
      ? "Diagnóstico Essencial"
      : "Diagnóstico";

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">{heading}</h1>
          <p className="page-sub">
            {isOrg
              ? "Jornada para empresas maiores: campanha estruturada e consolidação por áreas/grupos → pontos de atenção que viram Plano de Ação e dossiê organizacional."
              : "Jornada guiada para empresas menores: autoavaliação + escuta dos empregados → pontos de atenção que viram Plano de Ação e dossiê (AEP/AEP+PGR)."}
          </p>
        </div>
      </div>

      {status === "loading" && <p className="dash-state">Carregando…</p>}

      {status === "ok" && (
        <>
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="card__head">
              <div>
                <h3>1. Autoavaliação guiada</h3>
                <span className="card__sub">Respondida pelo dono/gestor/responsável — leitura de maturidade em 5 dimensões.</span>
              </div>
            </div>
            {assessment ? <AssessmentResult a={assessment} onRedo={() => setAssessment(null)} /> : <AssessmentForm onDone={refresh} />}
          </div>

          {/* A jornada promete "autoavaliação + escuta dos empregados" (subtítulo
              acima), mas a escuta não tinha nenhum mecanismo nesta tela: o cliente
              chegava aqui, não achava como enviar nada ao time e trocava o método
              do contrato só para conseguir disparar. O link é o MESMO /q/<slug> da
              empresa — mesma tabela, mesmo agregado, sem caminho paralelo. */}
          <EscutaDosEmpregados />

          <RecordsBlock records={records} onChanged={refresh} />

          <p className="dash-state" style={{ marginTop: 8 }}>
            Próximo passo: transforme os pontos de atenção em ações no menu <strong>Plano de Ação &amp; Evidências</strong> e gere o dossiê.
          </p>
        </>
      )}
    </>
  );
}

function AssessmentResult({ a, onRedo }: { a: SelfAssessmentData; onRedo: () => void }) {
  return (
    <div>
      <div className="kpi-grid" style={{ marginBottom: 14 }}>
        <div className="kpi">
          <span className="kpi__label">Maturidade geral</span>
          <strong className="kpi__value">{a.score}</strong>
          <span className="kpi__delta">{MATURITY_LABEL[a.result.level]}</span>
        </div>
        <div className="kpi">
          <span className="kpi__label">Ponto de atenção</span>
          <strong className="kpi__value" style={{ fontSize: 18, fontFamily: "var(--font-display)" }}>
            {(a.result.topAttentions ?? [a.result.topAttention]).map((d) => PRE_DIAGNOSTIC_DIMENSION_LABEL[d]).join(" · ")}
          </strong>
          <span className="kpi__delta">menor maturidade</span>
        </div>
      </div>
      <table className="data-table">
        <thead><tr><th>Dimensão</th><th>Maturidade</th></tr></thead>
        <tbody>
          {PRE_DIAGNOSTIC_DIMENSIONS.map((d) => (
            <tr key={d}>
              <td>{PRE_DIAGNOSTIC_DIMENSION_LABEL[d]}{(a.result.topAttentions ?? [a.result.topAttention]).includes(d) && <span className="card__sub"> · atenção</span>}</td>
              <td><strong>{a.result.byDimension[d]}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn btn--ghost btn--sm" style={{ marginTop: 12 }} onClick={onRedo}>Refazer autoavaliação</button>
    </div>
  );
}

function AssessmentForm({ onDone }: { onDone: () => void }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);
  const total = PRE_DIAGNOSTIC_QUESTIONS.length;
  const done = Object.keys(answers).length === total;

  async function submit() {
    setSaving(true);
    try {
      await submitSelfAssessment({ answers: PRE_DIAGNOSTIC_QUESTIONS.map((q) => ({ questionId: q.id, value: answers[q.id] })) });
      await onDone();
    } catch (e) { alert(e instanceof Error ? e.message : "Falha"); } finally { setSaving(false); }
  }

  return (
    <div>
      <ScaleHelpBox scale={PRE_DIAGNOSTIC_SCALE} />
      <ol className="essencial-q">
        {PRE_DIAGNOSTIC_QUESTIONS.map((q) => (
          <li key={q.id}>
            <p>{q.text}</p>
            <div className="essencial-scale">
              {PRE_DIAGNOSTIC_SCALE.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  title={opt.label}
                  className={`essencial-opt${answers[q.id] === opt.value ? " is-sel" : ""}`}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt.value }))}
                >
                  {opt.value}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <button className="btn btn--terra btn--sm" disabled={!done || saving} onClick={submit}>
        {saving ? "Salvando…" : done ? "Concluir autoavaliação" : `Responda todas (${Object.keys(answers).length}/${total})`}
      </button>
    </div>
  );
}

/**
 * Passo 2 da jornada — escuta dos empregados. Usa o MESMO link público da
 * empresa (/q/<slug>) que a tela do Organizacional já usa: as respostas caem em
 * psychosocial_responses e alimentam o mesmo agregado. Um link próprio daqui
 * criaria uma segunda base que o Dashboard não lê.
 */
function EscutaDosEmpregados() {
  const [slug, setSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    getPsychosocialLink()
      .then((r) => setSlug(r.slug))
      .catch(() => setSlug(null))
      .finally(() => setLoading(false));
  }, []);

  const url = slug ? `${publicOrigin()}/q/${slug}` : "";

  async function gerar() {
    setGerando(true);
    try {
      setSlug((await ensurePsychosocialLink()).slug);
    } finally {
      setGerando(false);
    }
  }
  function copiar() {
    if (!url) return;
    navigator.clipboard?.writeText(url).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    });
  }

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="card__head">
        <div>
          <h3>2. Escuta dos empregados</h3>
          <span className="card__sub">
            Link anônimo para o time responder sem login. As respostas entram no agregado da
            empresa (visível a partir de 5 respostas) e viram pontos de atenção no Plano de Ação.
          </span>
        </div>
      </div>
      {loading ? (
        <p className="card__sub">Carregando…</p>
      ) : slug ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            style={{
              flex: 1,
              minWidth: 240,
              padding: "10px 12px",
              border: "1px solid var(--line)",
              borderRadius: 10,
              fontSize: 13,
              background: "var(--surface,#fff)",
            }}
          />
          <button className="btn btn--gold btn--sm" onClick={copiar}>
            {copiado ? "Copiado" : "Copiar"}
          </button>
          <a className="btn btn--ghost btn--sm" href={url} target="_blank" rel="noreferrer">
            Abrir
          </a>
        </div>
      ) : (
        <button className="btn btn--gold btn--sm" onClick={gerar} disabled={gerando}>
          {gerando ? "Gerando…" : "Gerar link público"}
        </button>
      )}
      <p className="card__sub" style={{ marginTop: 12 }}>
        Precisa de prazo, lembrete ou recorte por setor?{" "}
        <a href="#" data-route-link="campanhas" style={{ fontWeight: 600 }}>
          Criar uma campanha de diagnóstico
        </a>
        .
      </p>
    </div>
  );
}

function RecordsBlock({ records, onChanged }: { records: EssentialRecordData[]; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="card__head">
        <div>
          <h3>2. Escuta &amp; observação</h3>
          <span className="card__sub">Registros de escuta com empregados e observação da atividade.</span>
        </div>
        <button className="btn btn--terra btn--sm" onClick={() => setAdding(true)}>Novo registro</button>
      </div>
      {adding && <RecordForm onClose={() => setAdding(false)} onAdded={async () => { setAdding(false); await onChanged(); }} />}
      <ul className="lib-list">
        {records.map((r) => (
          <li key={r.id} className="lib-row">
            <span className="lib-ic">{r.kind === "ESCUTA" ? "☶" : "◎"}</span>
            <div>
              <strong>{r.title}</strong>
              <span>{ESSENTIAL_RECORD_LABEL[r.kind]}{r.recordDate ? ` · ${new Date(r.recordDate).toLocaleDateString("pt-BR")}` : ""}{r.participants ? ` · ${r.participants}` : ""}</span>
            </div>
          </li>
        ))}
        {records.length === 0 && <li className="card__sub">Nenhum registro ainda.</li>}
      </ul>
    </div>
  );
}

function RecordForm({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [f, setF] = useState({ kind: "ESCUTA" as EssentialRecordKind, title: "", recordDate: "", participants: "", notes: "", points: "" });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createEssentialRecord({
        kind: f.kind, title: f.title.trim(),
        recordDate: f.recordDate || null, participants: f.participants || undefined,
        notes: f.notes || undefined, points: f.points || undefined,
      });
      await onAdded();
    } catch (err) { alert(err instanceof Error ? err.message : "Falha"); } finally { setSaving(false); }
  }
  return (
    <form onSubmit={submit} style={{ padding: 14, background: "var(--line-soft)", borderRadius: 8, marginBottom: 12 }}>
      <div className="prod-form__grid">
        <label className="prod-field"><span>Tipo</span>
          <select value={f.kind} onChange={(e) => set("kind")(e.target.value)}>
            <option value="ESCUTA">Escuta com empregados</option>
            <option value="OBSERVACAO">Observação da atividade</option>
          </select>
        </label>
        <label className="prod-field"><span>Data</span>
          <input type="date" value={f.recordDate} onChange={(e) => set("recordDate")(e.target.value)} />
        </label>
        <label className="prod-field prod-field--full"><span>Título</span>
          <input value={f.title} onChange={(e) => set("title")(e.target.value)} required placeholder="Ex.: Roda de conversa — turno B" />
        </label>
        <label className="prod-field prod-field--full"><span>Participantes / contexto</span>
          <input value={f.participants} onChange={(e) => set("participants")(e.target.value)} />
        </label>
        <label className="prod-field prod-field--full"><span>Anotações</span>
          <textarea rows={2} value={f.notes} onChange={(e) => set("notes")(e.target.value)} />
        </label>
        <label className="prod-field prod-field--full"><span>Pontos de atenção identificados</span>
          <textarea rows={2} value={f.points} onChange={(e) => set("points")(e.target.value)} />
        </label>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn btn--terra btn--sm" disabled={saving || !f.title.trim()}>{saving ? "Salvando…" : "Salvar registro"}</button>
      </div>
    </form>
  );
}
