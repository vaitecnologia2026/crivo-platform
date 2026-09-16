"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ICD_AXES,
  ICD_AXIS_LABEL,
  ICD_AXIS_DESCRIPTION,
  MIN_LEADERS_FOR_DISCLOSURE,
  POCKET_DIMENSIONS,
  POCKET_DIMENSION_LABEL,
  type IcdAxis,
  type IcdCycleHistoryEntry,
  type IcdCurrentSummary,
  type PocketAggregate,
  type CompanyQuarterlyIcdData,
  type IcdCycleData,
} from "@crivo/types";
import { ApiError, getIcdCurrent, getIcdCurrentSummary, getIcdHistory, getPocketAggregate } from "@/lib/api";
import { exportPDF, exportXLSX, useExportContext, type ExportSection, type ExportSheet } from "@/lib/exports";
import { useIcdDashboard, PATTERN_LABEL, DIMENSION_LABEL } from "./useIcdDashboard";

/**
 * Programas › Liderança (rota `icd`) — painel EXCLUSIVAMENTE AGREGADO do
 * programa: ICD oficial (4 Eixos, ciclo trimestral) por dimensão e sua
 * evolução por ciclo, mais adesão/volume do Pocket por tema. Layout do
 * protótipo Lovable (KPIs · radar · evolução · Pocket · CTA), com dados reais:
 *   - KPIs         ← GET /icd-cycles/current/summary
 *   - radar        ← GET /icd-cycles/current (o mesmo do Dashboard)
 *   - evolução     ← GET /icd-cycles/history (só o que o fechamento congelou)
 *   - Pocket       ← GET /pocket/aggregate (contagens por dimensão + adesão)
 * Tudo com supressão n < MIN_LEADERS_FOR_DISCLOSURE aplicada no servidor —
 * nada aqui recalcula nem individualiza. O que o líder faz (Pocket, Registro
 * de Decisão, ICD individual) fica na Área do Líder, não neste portal.
 *
 * Escala: o ICD oficial é 0–100 (Anexo §8: resposta 1–5 → (valor − 1) × 25).
 * O protótipo desenhava 0–5; aqui o eixo é o real, para não inventar escala.
 *
 * O modelo LEGADO dos 4 Rs (GET /icd/dashboard) fica no fim, como "Leitura
 * legada", para quem ainda acompanha o histórico daquele instrumento.
 */

type LoadStatus = "loading" | "error" | "ok";

// 403 do ModuleGuard = módulo não contratado (icd ou pocket). Não é falha: a
// tela explica de onde o dado viria quando o módulo for liberado.
const moduloDesligado = (err: unknown) => err instanceof ApiError && err.status === 403;

/** Carrega um recurso agregado; `data` null + status ok = módulo desligado. */
function useAgregado<T>(loader: () => Promise<T>): { data: T | null; status: LoadStatus; refresh: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [tick, setTick] = useState(0);
  // Estado só muda APÓS o await (sem setState síncrono no effect) — o
  // "loading" do refetch é marcado no próprio handler `refresh`.
  useEffect(() => {
    let alive = true;
    loader()
      .then((d) => { if (alive) { setData(d); setStatus("ok"); } })
      .catch((err) => {
        if (!alive) return;
        if (moduloDesligado(err)) { setData(null); setStatus("ok"); return; }
        setStatus("error");
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
  const refresh = useCallback(() => { setStatus("loading"); setTick((t) => t + 1); }, []);
  return { data, status, refresh };
}

// ── Ícones SVG de traço (regra do cliente: nunca emoji) ──
const Svg = ({ children, size = 14 }: { children: ReactNode; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: "-0.15em", flexShrink: 0 }}>
    {children}
  </svg>
);
const IconShield = () => (<Svg><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z" /><path d="M9 12l2 2 4-4" /></Svg>);
const IconDownload = () => (<Svg><path d="M12 4v11" /><path d="M7 10l5 5 5-5" /><path d="M4 20h16" /></Svg>);
const IconFile = () => (<Svg><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h6" /></Svg>);
const IconRefresh = () => (<Svg><path d="M20 12a8 8 0 1 1-2.3-5.7" /><path d="M20 4v5h-5" /></Svg>);
const IconPhone = ({ size = 20 }: { size?: number }) => (<Svg size={size}><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M11 18h2" /></Svg>);
const IconArrow = () => (<Svg><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></Svg>);

// Cores das 4 séries (mesmas famílias do protótipo: cobre, azul, céu, violeta).
const AXIS_COLOR: Record<IcdAxis, string> = {
  CLAREZA: "var(--gold)",
  CRITERIO: "var(--success)",
  ALINHAMENTO: "#0ea5e9",
  SUSTENTACAO: "#8b5cf6",
};
const AXIS_SHORT: Record<IcdAxis, string> = {
  CLAREZA: "Clareza",
  CRITERIO: "Critério",
  ALINHAMENTO: "Alinhamento",
  SUSTENTACAO: "Sustentação",
};

const fmtDelta = (d: number) => `${d > 0 ? "+" : ""}${d}`;
const cycleLabel = (c: IcdCycleData) => c.name || `${c.quarter}º tri/${c.year}`;
const goToRoute = (route: string) => document.querySelector<HTMLElement>(`[data-route="${route}"]`)?.click();

export function IcdScreen() {
  const summary = useAgregado<IcdCurrentSummary>(getIcdCurrentSummary);
  const current = useAgregado<{ cycle: IcdCycleData | null; company: CompanyQuarterlyIcdData | null }>(getIcdCurrent);
  const history = useAgregado<IcdCycleHistoryEntry[]>(getIcdHistory);
  const pocket = useAgregado<PocketAggregate>(() => getPocketAggregate());
  const legado = useIcdDashboard();
  const exportCtx = useExportContext();
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);

  const loading = [summary, current, history, pocket].some((r) => r.status === "loading");
  const refreshAll = () => { summary.refresh(); current.refresh(); history.refresh(); pocket.refresh(); legado.refresh(); };

  // ── Exportação (helper compartilhado da fatia 1). Só o que está na tela:
  // agregados já suprimidos; célula "suprimido" onde o servidor devolveu null.
  function buildSheets(): ExportSheet[] {
    const company = current.data?.company;
    const radar = ICD_AXES.map((ax) => ({
      Eixo: ICD_AXIS_LABEL[ax],
      "Média (0–100)": company && !company.suppressed && company.score != null ? Math.round(company.axesAverage[ax] ?? 0) : "suprimido / sem dado",
    }));
    const evolucao = (history.data ?? []).map((e) => ({
      Ciclo: cycleLabel(e.cycle),
      Status: e.cycle.status === "CLOSED" ? "Fechado" : "Aberto",
      "ICD (0–100)": e.company?.score ?? (e.company?.suppressed ? "suprimido" : ""),
      Clareza: e.company?.axesAverage?.CLAREZA ?? "",
      Critério: e.company?.axesAverage?.CRITERIO ?? "",
      Alinhamento: e.company?.axesAverage?.ALINHAMENTO ?? "",
      Sustentação: e.company?.axesAverage?.SUSTENTACAO ?? "",
      "Líderes elegíveis": e.company?.eligibleLeaders ?? "",
    }));
    const p = pocket.data;
    const pocketRows: Record<string, unknown>[] = (p?.byDimension ?? []).map((d) => ({
      Tema: d.label,
      "Sessões concluídas": d.sessions,
    }));
    // Suprimido: a aba diz isso em texto — nunca um zero que pareceria contagem.
    if (p && p.suppressed) pocketRows.push({ Tema: `Agregado suprimido (n < ${p.minLeadersForDisclosure})`, "Sessões concluídas": "suprimido" });
    return [
      { name: "ICD por dimensão", rows: radar },
      { name: "Evolução do ICD", rows: evolucao },
      { name: "Pocket por tema", rows: pocketRows },
    ];
  }
  async function handleExport(kind: "xlsx" | "pdf") {
    if (!exportCtx) return;
    setExporting(kind);
    try {
      const ctx = summary.data?.cycle ? { ...exportCtx, cycle: cycleLabel(summary.data.cycle) } : exportCtx;
      const sheets = buildSheets();
      if (kind === "xlsx") await exportXLSX("crivo-lideranca", sheets, ctx);
      else await exportPDF("crivo-lideranca", "Liderança · ICD agregado", sheets.map((s): ExportSection => ({ heading: s.name, rows: s.rows })), ctx);
    } finally {
      setExporting(null);
    }
  }

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Liderança</h1>
          <p className="page-sub">Visão exclusivamente agregada. Nenhuma métrica ou resposta individual é exibida no portal.</p>
        </div>
        <div className="route__actions" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className="pill" title={`Recortes com menos de ${MIN_LEADERS_FOR_DISCLOSURE} líderes são suprimidos (Anexo ICD §11).`} style={{ gap: 6 }}>
            <IconShield /> Confidencialidade: n ≥ {MIN_LEADERS_FOR_DISCLOSURE}
          </span>
          <button className="btn btn--outline-dark btn--sm" onClick={() => handleExport("xlsx")} disabled={!exportCtx || !!exporting || loading} title={!exportCtx ? "Carregando identificação da empresa…" : "Exportar os agregados desta tela em Excel"}>
            <IconDownload /> {exporting === "xlsx" ? "Gerando…" : "XLSX"}
          </button>
          <button className="btn btn--outline-dark btn--sm" onClick={() => handleExport("pdf")} disabled={!exportCtx || !!exporting || loading} title={!exportCtx ? "Carregando identificação da empresa…" : "Exportar os agregados desta tela em PDF"}>
            <IconFile /> {exporting === "pdf" ? "Gerando…" : "PDF"}
          </button>
          <button className="btn btn--outline-dark btn--sm" onClick={refreshAll} disabled={loading} title="Recarregar">
            <IconRefresh /> {loading ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>

      <Kpis summary={summary} pocket={pocket} />

      <div className="grid grid--2">
        <RadarCard current={current} />
        <EvolucaoCard history={history} />
      </div>

      <PocketCard pocket={pocket} />

      <div className="card" style={{ borderColor: "rgba(196,103,29,0.4)", background: "rgba(196,103,29,0.05)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(196,103,29,0.15)", color: "var(--gold-deep)", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <IconPhone />
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h3 style={{ margin: 0 }}>Continuar na Área do Líder</h3>
          <p className="card__sub" style={{ marginTop: 4 }}>
            Pocket, Registro de Decisão, respostas, ICD individual, histórico pessoal e Mentor contextual ficam na Área do Líder.
            O Portal apresenta apenas agregados autorizados (n ≥ {MIN_LEADERS_FOR_DISCLOSURE}) — sem individualização.
          </p>
        </div>
        <button className="btn btn--gold btn--sm" onClick={() => goToRoute("lider")} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          Continuar na Área do Líder <IconArrow />
        </button>
      </div>
      <p style={{ margin: "0 0 28px", fontSize: 12 }}>
        <a href="#" onClick={(e) => { e.preventDefault(); goToRoute("relatorios"); }} style={{ color: "var(--gold-deep)" }}>
          Ver ações vinculadas no Plano de Evolução →
        </a>
      </p>

      <LeituraLegada legado={legado} />
    </>
  );
}

// ── KPIs ──────────────────────────────────────────────────────────────────

function Kpis({ summary, pocket }: { summary: ReturnType<typeof useAgregado<IcdCurrentSummary>>; pocket: ReturnType<typeof useAgregado<PocketAggregate>> }) {
  const s = summary.data;
  const p = pocket.data;
  const semModulo = summary.status === "ok" && !s;

  if (summary.status === "loading") return <p className="dash-state">Carregando indicadores…</p>;
  if (summary.status === "error") {
    return (
      <div className="dash-state dash-state--error">
        Não foi possível carregar os indicadores.{" "}
        <button className="btn btn--outline-dark btn--sm" onClick={summary.refresh}>Tentar novamente</button>
      </div>
    );
  }
  if (semModulo) {
    return (
      <div className="dash-state">
        O programa Liderança (ICD) não está ativo para a sua empresa. Os indicadores aparecem aqui quando o módulo for liberado no contrato.
      </div>
    );
  }
  if (!s) return null;

  const participacaoPct = s.eligibleLeaders > 0 ? Math.round((s.participatingLeaders / s.eligibleLeaders) * 100) : null;
  const semCiclo = !s.cycle;

  return (
    <div className="kpi-grid">
      <div className="kpi">
        <span className="kpi__label" title="Média dos ICDs trimestrais dos líderes elegíveis no ciclo aberto (Anexo §9.5). Suprimido abaixo de 5 líderes.">ICD médio (agregado)</span>
        <strong className="kpi__value">
          {s.icdMedio != null ? s.icdMedio : "—"}
          {s.icdMedio != null && <small>/100</small>}
        </strong>
        {s.delta != null && s.lastClosed ? (
          <span className={`kpi__delta ${s.delta >= 0 ? "kpi__delta--up" : "kpi__delta--down"}`}>{fmtDelta(s.delta)} vs. {s.lastClosed.cycleName}</span>
        ) : (
          <span className="card__hint">
            {semCiclo ? "Nenhum ciclo trimestral aberto." : s.suppressed ? `Suprimido: ${s.participatingLeaders} de ${MIN_LEADERS_FOR_DISCLOSURE} líderes mínimos.` : s.icdMedio == null ? "Nenhuma decisão avaliada no ciclo." : "Sem ciclo anterior fechado para comparar."}
          </span>
        )}
        {s.band && <span className="card__hint">{s.band.label}</span>}
      </div>

      <div className="kpi">
        <span className="kpi__label">Líderes participantes</span>
        <strong className="kpi__value">{s.participatingLeaders}</strong>
        <span className="card__hint">
          {participacaoPct != null ? `${participacaoPct}% dos ${s.eligibleLeaders} líderes ativos` : "Nenhum líder ativo cadastrado"}
          {s.cycle ? ` · ${cycleLabel(s.cycle)}` : ""}
        </span>
      </div>

      <div className="kpi">
        <span className="kpi__label" title="O ICD não tem 'grupos' de líderes: a supressão é sobre o agregado da empresa. Abaixo do mínimo, nada é exibido.">Agregado suprimido (n &lt; {MIN_LEADERS_FOR_DISCLOSURE})</span>
        <strong className="kpi__value">{semCiclo ? "—" : s.suppressed ? "Sim" : "Não"}</strong>
        <span className="card__hint">
          {semCiclo
            ? "Sem ciclo aberto não há agregado."
            : s.suppressed
              ? "Menos de 5 líderes avaliados: nenhum valor é mostrado até alcançar o mínimo."
              : "Recortes por grupo não existem no ICD — o agregado é da empresa inteira."}
        </span>
      </div>

      <div className="kpi">
        <span className="kpi__label">Adesão Pocket</span>
        <strong className="kpi__value">
          {p && p.adhesionPct != null ? p.adhesionPct : "—"}
          {p && p.adhesionPct != null && <small>%</small>}
        </strong>
        <span className="card__hint">
          {pocket.status === "loading"
            ? "Carregando…"
            : pocket.status === "error"
              ? "Não foi possível carregar o Pocket."
              : !p
                ? "Módulo Pocket não liberado para a empresa."
                : p.suppressed
                  ? `Suprimido: ${p.participatingLeaders} líder(es) com sessão concluída (mínimo ${p.minLeadersForDisclosure}).`
                  : `${p.completedSessions} sessões concluídas · ${p.participatingLeaders} de ${p.eligibleLeaders} líderes${p.period ? ` · ${p.period.cycleName}` : " · todo o histórico"}`}
        </span>
      </div>
    </div>
  );
}

// ── Radar "ICD por dimensão" (SVG simples, sem lib) ──────────────────────

function RadarCard({ current }: { current: ReturnType<typeof useAgregado<{ cycle: IcdCycleData | null; company: CompanyQuarterlyIcdData | null }>> }) {
  const d = current.data;
  const company = d?.company;
  const ok = !!d?.cycle && !!company && !company.suppressed && company.score != null;

  return (
    <div className="card">
      <div className="card__head">
        <div>
          <h3>ICD por dimensão</h3>
          <span className="card__sub">Clareza, Critério, Alinhamento e Sustentação — escala 0–100 (média do ciclo aberto).</span>
        </div>
      </div>

      {current.status === "loading" && <p className="dash-state">Carregando os 4 Eixos…</p>}
      {current.status === "error" && <p className="dash-state dash-state--error">Não foi possível carregar os 4 Eixos.</p>}
      {current.status === "ok" && !d && <p className="dash-state">Módulo ICD não liberado para a empresa.</p>}
      {current.status === "ok" && d && !d.cycle && (
        <p className="dash-state">Nenhum ciclo trimestral aberto. O radar aparece quando um ciclo estiver aberto e houver decisões avaliadas pelo ICD.</p>
      )}
      {current.status === "ok" && d?.cycle && !ok && (
        <p className="dash-state">
          {company && company.eligibleLeaders > 0
            ? `Agregado suprimido: ${company.eligibleLeaders} líder(es) com decisões avaliadas — mínimo ${MIN_LEADERS_FOR_DISCLOSURE} (§11).`
            : "Nenhuma decisão avaliada pelo ICD neste ciclo ainda."}
        </p>
      )}
      {ok && company && (
        <>
          <Radar values={company.axesAverage} />
          <span className="card__eyebrow" style={{ display: "block", marginTop: 8 }}>
            Fonte: ICD oficial · ciclo {cycleLabel(d!.cycle!)} · n={company.eligibleLeaders} líderes · unidade: pontos (0–100) · parcial em tempo real
          </span>
        </>
      )}
    </div>
  );
}

function Radar({ values }: { values: Record<IcdAxis, number> }) {
  const cx = 160, cy = 130, r = 90;
  // 4 eixos: topo, direita, baixo, esquerda (sentido horário).
  const angle = (i: number) => -Math.PI / 2 + (i * Math.PI) / 2;
  const pt = (i: number, ratio: number) => [cx + Math.cos(angle(i)) * r * ratio, cy + Math.sin(angle(i)) * r * ratio] as const;
  const poly = (ratio: number) => ICD_AXES.map((_, i) => pt(i, ratio).join(",")).join(" ");
  const valuePoly = ICD_AXES.map((ax, i) => pt(i, Math.max(0, Math.min(100, values[ax] ?? 0)) / 100).join(",")).join(" ");
  const labelPos: Array<[number, number, "middle" | "start" | "end"]> = [
    [cx, cy - r - 12, "middle"],
    [cx + r + 10, cy + 4, "start"],
    [cx, cy + r + 20, "middle"],
    [cx - r - 10, cy + 4, "end"],
  ];
  return (
    <svg viewBox="0 0 320 270" style={{ width: "100%", height: 270, overflow: "visible" }} role="img" aria-label="Radar do ICD por dimensão">
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <polygon key={k} points={poly(k)} fill="none" stroke="var(--line)" strokeWidth={1} />
      ))}
      {ICD_AXES.map((_, i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line)" strokeWidth={1} />;
      })}
      <polygon points={valuePoly} fill="var(--gold)" fillOpacity={0.3} stroke="var(--gold)" strokeWidth={2} />
      {ICD_AXES.map((ax, i) => {
        const [x, y] = pt(i, Math.max(0, Math.min(100, values[ax] ?? 0)) / 100);
        return <circle key={ax} cx={x} cy={y} r={3.5} fill="var(--gold-deep)" />;
      })}
      {ICD_AXES.map((ax, i) => (
        <text key={ax} x={labelPos[i][0]} y={labelPos[i][1]} textAnchor={labelPos[i][2]} fontSize={11} fill="var(--text-sec)">
          <title>{ICD_AXIS_DESCRIPTION[ax]}</title>
          {AXIS_SHORT[ax]} · {Math.round(values[ax] ?? 0)}
        </text>
      ))}
      <text x={cx + 4} y={cy - r * 0.5 + 4} fontSize={9} fill="var(--text-mute)">50</text>
      <text x={cx + 4} y={cy - r + 4} fontSize={9} fill="var(--text-mute)">100</text>
    </svg>
  );
}

// ── "Evolução do ICD" — linhas por eixo ao longo dos ciclos fechados ───────

function EvolucaoCard({ history }: { history: ReturnType<typeof useAgregado<IcdCycleHistoryEntry[]>> }) {
  const h = history.data;
  const fechados = (h ?? []).filter((e) => e.cycle.status === "CLOSED" && e.company);
  const comValor = fechados.filter((e) => e.company && !e.company.suppressed && e.company.axesAverage);

  return (
    <div className="card">
      <div className="card__head">
        <div>
          <h3>Evolução do ICD</h3>
          <span className="card__sub">Séries por dimensão ao longo dos ciclos trimestrais fechados.</span>
        </div>
      </div>

      {history.status === "loading" && <p className="dash-state">Carregando ciclos…</p>}
      {history.status === "error" && <p className="dash-state dash-state--error">Não foi possível carregar a evolução.</p>}
      {history.status === "ok" && !h && <p className="dash-state">Módulo ICD não liberado para a empresa.</p>}
      {history.status === "ok" && h && fechados.length === 0 && (
        <p className="dash-state">Nenhum ciclo trimestral fechado ainda. A evolução é registrada no fechamento de cada ciclo.</p>
      )}
      {history.status === "ok" && h && fechados.length > 0 && comValor.length === 0 && (
        <p className="dash-state">
          {fechados.length} ciclo(s) fechado(s), todos suprimidos (menos de {MIN_LEADERS_FOR_DISCLOSURE} líderes elegíveis). Sem série a exibir.
        </p>
      )}
      {comValor.length > 0 && (
        <>
          <Linhas entries={comValor} />
          <div className="legend" style={{ flexWrap: "wrap", marginTop: 8 }}>
            {ICD_AXES.map((ax) => (
              <span className="legend__item" key={ax}><i style={{ background: AXIS_COLOR[ax] }} />{AXIS_SHORT[ax]}</span>
            ))}
          </div>
          {comValor.length < fechados.length && (
            <span className="card__hint" style={{ display: "block", marginTop: 6 }}>
              {fechados.length - comValor.length} ciclo(s) fechado(s) não aparecem: suprimidos (n &lt; {MIN_LEADERS_FOR_DISCLOSURE}).
            </span>
          )}
          <span className="card__eyebrow" style={{ display: "block", marginTop: 8 }}>
            Fonte: ICD oficial congelado no fechamento · agregado, n mínimo = {MIN_LEADERS_FOR_DISCLOSURE}
          </span>
        </>
      )}
    </div>
  );
}

function Linhas({ entries }: { entries: IcdCycleHistoryEntry[] }) {
  const W = 520, H = 220, padL = 32, padR = 12, padT = 12, padB = 28;
  const n = entries.length;
  const x = (i: number) => (n === 1 ? (W - padL - padR) / 2 + padL : padL + (i * (W - padL - padR)) / (n - 1));
  const y = (v: number) => padT + (H - padT - padB) * (1 - Math.max(0, Math.min(100, v)) / 100);
  return (
    <div className="line-chart">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ height: 220 }} role="img" aria-label="Evolução do ICD por eixo">
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={padL} x2={W - padR} y1={y(g)} y2={y(g)} stroke="var(--line)" strokeDasharray="3 3" />
            <text x={padL - 6} y={y(g) + 3} fontSize={9} textAnchor="end" fill="var(--text-mute)">{g}</text>
          </g>
        ))}
        {ICD_AXES.map((ax) => (
          <g key={ax}>
            <polyline
              fill="none"
              stroke={AXIS_COLOR[ax]}
              strokeWidth={2}
              points={entries.map((e, i) => `${x(i)},${y(e.company!.axesAverage![ax] ?? 0)}`).join(" ")}
            />
            {entries.map((e, i) => (
              <circle key={e.cycle.id} cx={x(i)} cy={y(e.company!.axesAverage![ax] ?? 0)} r={3} fill={AXIS_COLOR[ax]}>
                <title>{cycleLabel(e.cycle)} · {ICD_AXIS_LABEL[ax]}: {Math.round(e.company!.axesAverage![ax] ?? 0)}</title>
              </circle>
            ))}
          </g>
        ))}
        {entries.map((e, i) => (
          <text key={e.cycle.id} x={x(i)} y={H - 8} fontSize={10} textAnchor="middle" fill="var(--text-sec)">{cycleLabel(e.cycle)}</text>
        ))}
      </svg>
    </div>
  );
}

// ── "Pocket — Adesão por tema" (barras CSS: contagem; adesão à parte) ─────

function PocketCard({ pocket }: { pocket: ReturnType<typeof useAgregado<PocketAggregate>> }) {
  const p = pocket.data;
  const max = Math.max(1, ...(p?.byDimension?.map((d) => d.sessions) ?? [0]));
  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card__head">
        <div>
          <h3>Pocket — Adesão por tema</h3>
          <span className="card__sub">
            Sem score. Apenas adesão e volume de sessões concluídas nos temas: {POCKET_DIMENSIONS.map((d) => POCKET_DIMENSION_LABEL[d]).join(", ")}.
          </span>
        </div>
        {p && !p.suppressed && p.adhesionPct != null && (
          <span className="pill pill--gold">Adesão {p.adhesionPct}% · {p.participatingLeaders}/{p.eligibleLeaders} líderes</span>
        )}
      </div>

      {pocket.status === "loading" && <p className="dash-state">Carregando Pocket…</p>}
      {pocket.status === "error" && <p className="dash-state dash-state--error">Não foi possível carregar o agregado do Pocket.</p>}
      {pocket.status === "ok" && !p && (
        <p className="dash-state">Módulo Pocket não liberado para a empresa. O gráfico aparece quando o CRIVO Pocket™ for contratado.</p>
      )}
      {pocket.status === "ok" && p && p.suppressed && (
        <p className="dash-state">
          {p.participatingLeaders === 0
            ? `Nenhuma sessão Pocket concluída${p.period ? ` no ciclo ${p.period.cycleName}` : ""}.`
            : `Pocket: agregado suprimido (${p.participatingLeaders} líder(es) com sessão concluída — mínimo ${p.minLeadersForDisclosure}).`}
        </p>
      )}
      {pocket.status === "ok" && p && !p.suppressed && p.byDimension && (
        <>
          <div className="bars">
            {p.byDimension.map((d) => (
              <div className="bar-row" key={d.dimension}>
                <span className="bar-row__label" title={`Sessões concluídas com ao menos uma reflexão em ${d.label}`}>{d.label}</span>
                <div className="bar"><div className="bar__fill" style={{ width: `${(d.sessions / max) * 100}%`, background: "var(--success)" }} /></div>
                <span className="bar-row__value" style={{ fontVariantNumeric: "tabular-nums" }}>{d.sessions}</span>
              </div>
            ))}
          </div>
          <span className="card__eyebrow" style={{ display: "block", marginTop: 12 }}>
            Fonte: Pocket CRIVO · sessões concluídas na Área do Líder · {p.period ? `ciclo ${p.period.cycleName}` : "todo o histórico"} · {p.completedSessions} sessões · sem individualização
          </span>
        </>
      )}
    </div>
  );
}

// ── Leitura legada — modelo dos 4 Rs (GET /icd/dashboard) ─────────────────

const LEGACY_DIMENSIONS = ["reatividade", "rigidez", "repercussao", "risco"] as const;
function barClass(v: number): string {
  if (v >= 80) return "is-high";
  if (v >= 60) return "is-mid";
  return "is-low";
}

function LeituraLegada({ legado }: { legado: ReturnType<typeof useIcdDashboard> }) {
  const [open, setOpen] = useState(false);
  const { data, status } = legado;
  const dims = data ? LEGACY_DIMENSIONS.map((key) => ({ key, label: DIMENSION_LABEL[key] ?? key, value: data.dimensionAverages?.[key] ?? 0 })) : [];
  const pattern = data ? Object.entries(data.distribuicaoPadrao).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null : null;
  const vazio = !data || data.icdMedio === null || data.totalLideres === 0;

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card__head" style={{ cursor: "pointer" }} onClick={() => setOpen((o) => !o)}>
        <div>
          <h3>Leitura legada — 4 Rs</h3>
          <span className="card__sub">
            Instrumento anterior (Reatividade, Rigidez, Repercussão, Risco — score /100 e tensão dominante). Mantido para histórico; o modelo oficial é o dos 4 Eixos acima.
          </span>
        </div>
        <button className="btn btn--outline-dark btn--sm" onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>
          {open ? "Ocultar" : "Ver leitura legada"}
        </button>
      </div>
      {open && (
        <>
          {status === "loading" && <p className="dash-state">Carregando…</p>}
          {status === "error" && <p className="dash-state dash-state--error">Não foi possível carregar a leitura legada.</p>}
          {status === "ok" && vazio && <p className="dash-state">Nenhuma avaliação registrada no instrumento legado.</p>}
          {status === "ok" && data && !vazio && (
            <div className="grid grid--2" style={{ marginBottom: 0 }}>
              <div>
                <span className="card__eyebrow">COERÊNCIA POR DIMENSÃO (4 Rs)</span>
                <div className="icd-dims">
                  {dims.map((d) => (
                    <div className="icd-dim" key={d.key}>
                      <div className="icd-dim__top"><span>{d.label}</span><strong>{d.value}</strong></div>
                      <div className="icd-dim__bar"><div className={`icd-dim__fill ${barClass(d.value)}`} style={{ width: `${d.value}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="icd-side">
                <div className="card card--pattern">
                  <span className="card__eyebrow">ICD MÉDIO (LEGADO)</span>
                  <strong className="big-num">{data.icdMedio}<small>/100</small></strong>
                  <span className="card__hint">Média agregada de {data.totalLideres} líderes — sem identificação individual.</span>
                </div>
                <div className="card card--pattern">
                  <span className="card__eyebrow">TENSÃO DOMINANTE</span>
                  <strong className="pattern-label">{pattern ? (PATTERN_LABEL[pattern] ?? pattern) : "—"}</strong>
                  <div className="dash-dist" style={{ marginTop: 8 }}>
                    {Object.entries(data.distribuicaoPadrao).map(([k, n]) => (
                      <span key={k} className="dash-dist__item">{PATTERN_LABEL[k] ?? k}: <strong>{n}</strong></span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
