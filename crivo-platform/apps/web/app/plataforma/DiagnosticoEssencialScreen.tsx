"use client";

import { useEffect, useState } from "react";
import {
  ESSENTIAL_RECORD_LABEL,
  MATURITY_LABEL,
  PRE_DIAGNOSTIC_DIMENSION_LABEL,
  type AppliedDiagnosticData,
  type EssentialRecordData,
  type EssentialRecordKind,
  type MaturityLevel,
  type PreDiagnosticDimension,
  type SelfAssessmentData,
  type SelfAssessmentInstrument,
  type SelfAssessmentResult,
} from "@crivo/types";
import { publicOrigin } from "@/lib/share-url";
import {
  createEssentialRecord,
  ensurePsychosocialLink,
  getDiagnosticContext,
  getPsychosocialLink,
  getSelfAssessment,
  getSelfAssessmentInstrument,
  listAppliedDiagnostics,
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

          {/* O Super Admin cadastra diagnósticos no Motor e os APLICA à empresa
              (Metodologia → Aplicação, "Gerar link de aplicação"). Essa lista só
              existia no painel dele: no portal do cliente não havia nada, então
              o diagnóstico cadastrado para a empresa não aparecia para ela. */}
          <DiagnosticosAplicados />

          <RecordsBlock records={records} onChanged={refresh} />

          <p className="dash-state" style={{ marginTop: 8 }}>
            Próximo passo: transforme os pontos de atenção em ações no menu <strong>Plano de Ação &amp; Evidências</strong> e gere o dossiê.
          </p>
        </>
      )}
    </>
  );
}

/**
 * Rótulo da dimensão: o da VERSÃO que pontuou (metodologia ativa do Motor) e,
 * se ela não veio — resultados gravados antes deste ajuste —, o rótulo do padrão
 * embutido. Último recurso: o próprio slug, para nunca renderizar vazio.
 */
function dimLabelOf(r: SelfAssessmentResult, slug: string): string {
  return (
    r.dimensionLabels?.[slug] ??
    PRE_DIAGNOSTIC_DIMENSION_LABEL[slug as PreDiagnosticDimension] ??
    slug
  );
}

/** Rótulo da faixa: o publicado na metodologia; senão o do padrão embutido. */
function levelLabelOf(r: SelfAssessmentResult): string {
  return r.levelLabel ?? MATURITY_LABEL[r.level as MaturityLevel] ?? r.level;
}

function AssessmentResult({ a, onRedo }: { a: SelfAssessmentData; onRedo: () => void }) {
  const attentions = a.result.topAttentions ?? [a.result.topAttention];
  // As dimensões vêm do RESULTADO, não de uma lista fixa: com metodologia ativa
  // os slugs são os que o Motor publicou (podem não ser 5, nem os mesmos nomes).
  const dims = Object.keys(a.result.byDimension ?? {});
  return (
    <div>
      <div className="kpi-grid" style={{ marginBottom: 14 }}>
        <div className="kpi">
          <span className="kpi__label">Maturidade geral</span>
          {/* result.score guarda a precisão da versão (o motor v3.1 pode usar 1
              casa); a coluna `score` é inteira e serve de rede se faltar. */}
          <strong className="kpi__value">{a.result.score ?? a.score}</strong>
          <span className="kpi__delta">{levelLabelOf(a.result)}</span>
        </div>
        <div className="kpi">
          <span className="kpi__label">Ponto de atenção</span>
          <strong className="kpi__value" style={{ fontSize: 18, fontFamily: "var(--font-display)" }}>
            {attentions.map((d) => dimLabelOf(a.result, d)).join(" · ")}
          </strong>
          <span className="kpi__delta">menor maturidade</span>
        </div>
      </div>
      <table className="data-table">
        <thead><tr><th>Dimensão</th><th>Maturidade</th></tr></thead>
        <tbody>
          {dims.map((d) => (
            <tr key={d}>
              <td>{dimLabelOf(a.result, d)}{attentions.includes(d) && <span className="card__sub"> · atenção</span>}</td>
              <td><strong>{a.result.byDimension[d]}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn btn--ghost btn--sm" style={{ marginTop: 12 }} onClick={onRedo}>Refazer autoavaliação</button>
    </div>
  );
}

/**
 * Perguntas e escala vêm do MOTOR (metodologia ativa do Diagnóstico Executivo),
 * não mais das constantes fixas do `@crivo/types`. Era exatamente aqui que o
 * diagnóstico cadastrado deixava de aparecer para o cliente: a LP, o psicossocial
 * e o dossiê já liam a versão publicada e só esta tela seguia com o hardcode.
 * O fallback ao padrão embutido é feito no backend, então o contrato é um só.
 */
function AssessmentForm({ onDone }: { onDone: () => void }) {
  const [instrument, setInstrument] = useState<SelfAssessmentInstrument | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    getSelfAssessmentInstrument()
      .then((i) => { if (alive) { setInstrument(i); setStatus("ok"); } })
      .catch(() => { if (alive) setStatus("error"); });
    return () => { alive = false; };
  }, []);

  const questions = instrument?.questions ?? [];
  const scale = instrument?.scaleLabels ?? [];
  const total = questions.length;
  const answered = questions.filter((q) => answers[q.id]).length;
  const done = total > 0 && answered === total;

  async function submit() {
    setSaving(true);
    try {
      await submitSelfAssessment({ answers: questions.map((q) => ({ questionId: q.id, value: answers[q.id] })) });
      await onDone();
    } catch (e) { alert(e instanceof Error ? e.message : "Falha"); } finally { setSaving(false); }
  }

  if (status === "loading") return <p className="card__sub">Carregando o instrumento…</p>;
  if (status === "error")
    return <p className="dash-state dash-state--error">Não foi possível carregar as perguntas do diagnóstico.</p>;

  return (
    <div>
      <ScaleHelpBox scale={scale.map((label, i) => ({ value: i + 1, label }))} />
      <ol className="essencial-q">
        {questions.map((q) => (
          <li key={q.id}>
            <p>{q.text}</p>
            <div className="essencial-scale">
              {scale.map((label, i) => (
                <button
                  key={i + 1}
                  type="button"
                  title={label}
                  className={`essencial-opt${answers[q.id] === i + 1 ? " is-sel" : ""}`}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: i + 1 }))}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <button className="btn btn--terra btn--sm" disabled={!done || saving} onClick={submit}>
        {saving ? "Salvando…" : done ? "Concluir autoavaliação" : `Responda todas (${answered}/${total})`}
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
        {/* Navega pelo item real da sidebar: o binding de data-route-link roda no
            boot do shell, antes desta ilha existir, então href="#" não navegava
            (só jogava a página ao topo). Mesmo padrão do SuporteScreen. */}
        <button
          type="button"
          onClick={() => document.querySelector<HTMLElement>('.nav-item[data-route="campanhas"]')?.click()}
          style={{
            fontWeight: 600,
            background: "none",
            border: "none",
            padding: 0,
            color: "inherit",
            cursor: "pointer",
            textDecoration: "underline",
            font: "inherit",
          }}
        >
          Criar uma campanha de diagnóstico
        </button>
        .
      </p>
    </div>
  );
}

/**
 * Diagnósticos do catálogo que a CRIVO cadastrou no Motor e APLICOU a esta
 * empresa (Metodologia → Aplicação). Cada um tem o seu link público /d/<slug>,
 * o mesmo que o Super Admin copia — uma fonte só, sem caminho paralelo. Link
 * revogado continua listado (o histórico de respostas é dele), mas sem botões.
 */
function DiagnosticosAplicados() {
  const [items, setItems] = useState<AppliedDiagnosticData[] | null>(null);
  const [erro, setErro] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listAppliedDiagnostics()
      .then((r) => { if (alive) setItems(r); })
      .catch(() => { if (alive) { setItems([]); setErro(true); } });
    return () => { alive = false; };
  }, []);

  const urlOf = (slug: string) => `${publicOrigin()}/d/${slug}`;

  function copiar(d: AppliedDiagnosticData) {
    navigator.clipboard?.writeText(urlOf(d.slug)).then(() => {
      setCopiado(d.id);
      setTimeout(() => setCopiado((c) => (c === d.id ? null : c)), 1800);
    });
  }

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="card__head">
        <div>
          {/* Sem número: os blocos numerados são os passos da jornada validada
              (1. autoavaliação · 2. escuta) e a numeração deles não se mexe. */}
          <h3>Diagnósticos aplicados pela CRIVO</h3>
          <span className="card__sub">
            Instrumentos do Motor CRIVO liberados para a sua empresa. Cada um tem um link anônimo
            próprio — as respostas entram no agregado da empresa (visível a partir de 5 respostas).
          </span>
        </div>
      </div>
      {items === null ? (
        <p className="card__sub">Carregando…</p>
      ) : erro ? (
        <p className="dash-state dash-state--error">Não foi possível carregar os diagnósticos aplicados.</p>
      ) : items.length === 0 ? (
        <p className="card__sub">
          Nenhum diagnóstico do catálogo liberado até agora. A autoavaliação e a escuta acima seguem
          disponíveis; novos instrumentos aparecem aqui assim que a CRIVO os aplicar à sua empresa.
        </p>
      ) : (
        <ul className="lib-list">
          {items.map((d) => (
            <li key={d.id} className="lib-row">
              <span className="lib-ic">✦</span>
              <div>
                <strong>{d.name}</strong>
                <span>
                  {d.description ? `${d.description} · ` : ""}
                  {d.bandKind === "RISK" ? "régua de risco" : "régua de maturidade"} ·{" "}
                  {d.respondents} resposta(s)
                  {!d.active && " · link revogado pela CRIVO"}
                </span>
              </div>
              {d.active && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn--gold btn--sm" onClick={() => copiar(d)}>
                    {copiado === d.id ? "Copiado" : "Copiar link"}
                  </button>
                  <a className="btn btn--ghost btn--sm" href={urlOf(d.slug)} target="_blank" rel="noreferrer">
                    Abrir
                  </a>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
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
