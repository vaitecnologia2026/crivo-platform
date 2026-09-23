"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useIcdDashboard, useIcdAxes, PATTERN_LABEL, DIMENSION_LABEL, type IcdAxesData, type LoadStatus } from "./useIcdDashboard";
import {
  getDashboardDiagnostic,
  getMyModules,
  getPsychosocialResults,
  getIcdHistory,
  listActionPlans,
  listCampaigns,
  listDocuments,
  listReportEmissions,
  type DashboardDiagnostic,
  type PsychosocialResults,
  type ReportEmissionMeta,
} from "@/lib/api";
import { exportPDF, exportXLSX, useExportContext, type ExportSection, type ExportSheet } from "@/lib/exports";
import { IconDownload, IconFileText, IconRefresh } from "./Icons";
import {
  montarAcoesPrioritarias,
  montarAlertas,
  montarCobertura,
  montarDistribuicao,
  montarDistribuicaoPorFator,
  montarEvolucaoCobertura,
  montarEvolucaoIcd,
  montarFatores,
  montarRadarIcd,
  type AcaoPrioritaria,
  type Alerta,
  type BlocoDistribuicao,
  type BlocoEvolucao,
  type BlocoFatores,
  type BlocoPorFator,
} from "@/lib/visao-geral-blocos";
import {
  ChartCard,
  COR_SERIE,
  Donut,
  GraficoBarrasEmpilhadas,
  GraficoBarrasH,
  GraficoLinha,
  GraficoRadar,
  Legenda,
} from "./Charts";
import { ResultadoDiagnosticoCard } from "./ResultadoDiagnosticoCard";
import { OnboardingChecklist } from "./OnboardingChecklist";
import { OperationalAlerts } from "./OperationalAlerts";
import {
  ACTION_STATUS_LABEL,
  classifyTechnicalRisk,
  RISK_LEVELS_3,
  type RiskLevel3,
  getIcdMaturityBand,
  ICD_AXES,
  ICD_AXIS_LABEL,
  ICD_AXIS_DESCRIPTION,
  MIN_LEADERS_FOR_DISCLOSURE,
  PSYCHOSOCIAL_RISK_LABEL,
  PSYCHOSOCIAL_DIMENSION_LABEL,
  type ActionItemData,
  type ActionPlanData,
  type ActionStatus,
  type CampaignSummary,
  type DocumentDescriptor,
  type IcdCycleHistoryEntry,
} from "@crivo/types";

/**
 * Card "Fatores Psicossociais" do Dashboard. Antes exibia um texto fixo mesmo
 * quando o diagnóstico organizacional já tinha respostas; agora lê os resultados
 * (mesmo endpoint do ExecutiveKpiRow) e mostra a leitura real quando há dado,
 * mantendo o texto de origem apenas como estado vazio/suprimido.
 */
function FatoresPsicossociaisCard({ diag, psy }: { diag: DashboardDiagnostic | null; psy: PsychosocialResults | null }) {

  const hasData = psy != null && psy.totalRespondents > 0;
  const overall = psy && !psy.overall.suppressed ? psy.overall : null;

  // Empresa que nao contratou o Organizacional nao pode ver "sera habilitado
  // quando o modulo NR-1 for aplicado": e outro produto, e a frase aparecia ao
  // lado do resultado do diagnostico que ela DE FATO contratou. Some so com
  // prova positiva — enquanto o contrato nao chega (null), o card segue como era.
  if (diag?.engine === "DIAGNOSTICS" && !hasData) return null;
  // Motor de diagnósticos (Essencial etc.): /psychosocial/results devolve o
  // MESMO resultado do diagnóstico contratado, mas com os códigos crus da
  // metodologia — o card mostrava "EM_ESTRUTURACAO" e "dim-1" ao lado do
  // card "Resultado do diagnóstico", que já traz tudo com rótulo. Some.
  if (diag?.engine === "DIAGNOSTICS") return null;

  return (
    <div className="card">
      <div className="card__head">
        <div>
          <h3>Fatores Psicossociais</h3>
          <span className="card__sub">Leitura estruturada dos riscos relacionados ao trabalho (NR-1).</span>
        </div>
      </div>
      {hasData ? (
        <div className="kpi-grid" style={{ marginTop: 4 }}>
          <div className="kpi">
            <span className="kpi__label">Participação</span>
            <strong className="kpi__value">{psy!.totalRespondents}</strong>
            <span className="kpi__delta">{psy!.sectors.length} setor(es) avaliado(s)</span>
          </div>
          <div className="kpi">
            <span className="kpi__label">Nível geral</span>
            <strong className="kpi__value">
              {/* Rótulo da FAIXA da metodologia ativa; o mapa fixo é só para a
                  metodologia original (BAIXO/MODERADO/…). Nunca o código cru. */}
              {overall ? (overall.levelLabel ?? PSYCHOSOCIAL_RISK_LABEL[overall.level] ?? overall.level) : "Protegido"}
            </strong>
            <span className="kpi__delta">
              {overall
                ? `Maior atenção: ${overall.dimensionLabels?.[overall.topRisk] ?? PSYCHOSOCIAL_DIMENSION_LABEL[overall.topRisk] ?? overall.topRisk}`
                : `Volume mínimo: ${psy!.minRespondents}+ respondentes por recorte`}
            </span>
          </div>
        </div>
      ) : (
        <p className="dash-state" style={{ margin: 0 }}>
          Será habilitado quando o módulo <strong>Campanhas de Diagnóstico (NR-1)</strong> for aplicado.
        </p>
      )}
    </div>
  );
}

const PORTAL_S11 =
  "O ICD do Líder é ferramenta de desenvolvimento e sustentação da liderança. Não deve ser utilizado para ranking individual, punição, promoção, avaliação de performance ou comparação nominal entre líderes.";

const DIMENSIONS = ["reatividade", "rigidez", "repercussao", "risco"] as const;

function scoreClass(score: number): string {
  if (score >= 80) return "is-high";
  if (score >= 60) return "is-mid";
  return "is-low";
}

/** Anexo ICD §10 — leitura executiva derivada da faixa de maturidade. */
function attention(score: number | null): { label: string; tone: "ok" | "alert" | "crit" | "na" } {
  if (score === null || Number.isNaN(score)) return { label: "Sem dados", tone: "na" };
  if (score < 50) return { label: "Crítico", tone: "crit" };
  if (score < 75) return { label: "Em atenção", tone: "alert" };
  return { label: "Em equilíbrio", tone: "ok" };
}

interface PlanStats {
  total: number;
  open: number; // sugeridas/em revisão/aprovadas/em andamento
  done: number; // concluídas
  byStatus: Partial<Record<ActionStatus, number>>;
  latest: ActionPlanData[];
}

function computePlanStats(plans: ActionPlanData[]): PlanStats {
  const byStatus: Partial<Record<ActionStatus, number>> = {};
  let open = 0;
  let done = 0;
  const items: ActionItemData[] = plans.flatMap((p) => p.items);
  for (const it of items) {
    byStatus[it.status] = (byStatus[it.status] ?? 0) + 1;
    if (it.status === "CONCLUIDA") done += 1;
    // Descartada (NAO_ADOTADA) não é aberta: apareceu como "12 aprovadas em
    // aberto" na Visão Geral no primeiro descarte em massa (21/09).
    else if (it.status !== "REAVALIADA" && it.status !== "NAO_ADOTADA") open += 1;
  }
  return {
    total: items.length,
    open,
    done,
    byStatus,
    latest: plans.slice(0, 3),
  };
}

/** 4 EIXOS (modelo OFICIAL) — Clareza/Critério/Alinhamento/Sustentação.
 *  Agregado do ciclo trimestral ABERTO (peso por impacto + supressão <5,
 *  computados server-side). Sem ranking ou identificação nominal (§11). */
function IcdAxesOfficial({ axes, status }: { axes: IcdAxesData | null; status: LoadStatus }) {
  if (status === "loading") {
    return <p className="dash-state" style={{ margin: "0 0 14px" }}>Carregando os 4 Eixos…</p>;
  }
  if (status === "error") {
    return <p className="dash-state" style={{ margin: "0 0 14px" }}>Não foi possível carregar os 4 Eixos do ICD.</p>;
  }
  if (!axes) {
    // 403 do gate de módulo (ver useIcdAxes): a empresa não tem o módulo
    // Liderança/ICD contratado — não é erro, é ausência de contratação.
    return (
      <p className="dash-state" style={{ margin: "0 0 14px" }}>
        O programa Liderança (ICD) não está ativo para a sua empresa. Os 4 Eixos aparecem aqui quando o módulo for liberado no contrato.
      </p>
    );
  }
  const { cycle, company } = axes;
  if (!cycle) {
    return (
      <p className="dash-state" style={{ margin: "0 0 14px" }}>
        Os <strong>4 Eixos (modelo oficial)</strong> — Clareza, Critério, Alinhamento e Sustentação — entram em uso ao
        abrir um <strong>ciclo trimestral</strong> e registrar decisões avaliadas pelo ICD. Nenhum ciclo aberto no momento.
      </p>
    );
  }
  if (!company || company.suppressed || company.score == null || company.band == null) {
    return (
      <p className="dash-state" style={{ margin: "0 0 14px" }}>
        ICD oficial sob <strong>supressão de confidencialidade</strong> (§11): mínimo {MIN_LEADERS_FOR_DISCLOSURE} líderes
        com decisões avaliadas no ciclo. Atualmente {company?.eligibleLeaders ?? 0}.
      </p>
    );
  }
  return (
    <div className="eixos-official">
      <div className="eixos-official__head">
        <div className="eixos-official__score">
          <strong className={`dash-score ${scoreClass(company.score)}`}>{company.score}</strong>
          <span>{company.band.label}</span>
        </div>
        <span className="card__sub">
          Ciclo {cycle.name || `${cycle.quarter}º tri/${cycle.year}`} · {company.eligibleLeaders} líderes elegíveis · em tempo real
        </span>
      </div>
      <div className="eixos-grid">
        {ICD_AXES.map((ax) => {
          const v = Math.round(company.axesAverage[ax] ?? 0);
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


// ═══════════════════════════════════════════════════════════════════════════
// Blocos portados do protótipo (lovable/Portal do Cliente/src/routes/dashboard.tsx)
//
// O protótipo desenha com recharts + shadcn; o portal não tem nenhum dos dois,
// então os gráficos vêm de ./Charts (SVG na mão, com eixo, grade e legenda).
// O que muda de verdade é a FONTE: lá são constantes de demonstração, aqui é o
// que a API devolve — e quando não há fonte, o card DIZ que não há.
// ═══════════════════════════════════════════════════════════════════════════

type Aba = "panorama" | "diagnosticos" | "execucao";
const ABAS: [Aba, string][] = [
  ["panorama", "Panorama"],
  ["diagnosticos", "Diagnósticos"],
  ["execucao", "Execução"],
];

/** Bloco do protótipo que NÃO tem fonte de dado no portal. Diz o que falta em
 *  vez de desenhar uma curva inventada. */
function SemFonteCard({ title, description, motivo }: { title: string; description: string; motivo: string }) {
  return (
    <ChartCard title={title} description={description}>
      <p className="dash-state" style={{ margin: 0 }}>{motivo}</p>
    </ChartCard>
  );
}

function FatoresPrioritariosCard({ bloco, acoes }: { bloco: BlocoFatores | null; acoes?: React.ReactNode }) {
  if (!bloco) {
    return (
      <SemFonteCard
        title="Fatores prioritários"
        description="Ordenação dos fatores pelo risco do ciclo atual."
        motivo="Disponível quando o diagnóstico tiver respostas suficientes para liberar o resultado."
      />
    );
  }
  return (
    <ChartCard title={bloco.titulo} description={bloco.descricao} source={bloco.fonte} actions={acoes}>
      <GraficoBarrasH
        linhas={bloco.linhas.map((l) => ({ chave: l.chave, rotulo: l.rotulo, valor: l.valor, cor: l.cor, nota: l.nota }))}
        max={bloco.linhas[0]?.max ?? 100}
      />
    </ChartCard>
  );
}

function DistribuicaoRiscoCard({ bloco }: { bloco: BlocoDistribuicao | null }) {
  if (!bloco) {
    return (
      <SemFonteCard
        title="Distribuição de risco"
        description="Quantos fatores caem em cada faixa."
        motivo="Disponível quando o resultado do diagnóstico for liberado."
      />
    );
  }
  return (
    <ChartCard title="Distribuição de risco" description="Quantos fatores caem em cada faixa de classificação." source={bloco.fonte}>
      <Donut fatias={bloco.fatias} centro={bloco.total} legenda={bloco.legenda} />
      <Legenda itens={bloco.fatias.map((f) => ({ rotulo: `${f.rotulo}: ${f.valor}`, cor: f.cor }))} />
    </ChartCard>
  );
}

/** "Distribuição por fator" do protótipo — % de PESSOAS em cada faixa, por
 *  dimensão. Duas dimensões com a mesma média podem ter distribuições bem
 *  diferentes, e é a concentração na faixa crítica que move a matriz. */
function DistribuicaoPorFatorCard({ bloco }: { bloco: BlocoPorFator | null }) {
  if (!bloco) {
    return (
      <SemFonteCard
        title="Distribuição por fator"
        description="Percentual de respondentes em cada faixa, dimensão a dimensão."
        motivo="Depende das faixas da metodologia ativa e de resultado liberado. Aparece assim que a coleta atingir o mínimo de respondentes."
      />
    );
  }
  return (
    <ChartCard
      title="Distribuição por fator"
      description="Percentual de respondentes em cada faixa, dimensão a dimensão."
      source={bloco.fonte}
    >
      <GraficoBarrasEmpilhadas linhas={bloco.linhas} />
      <Legenda itens={bloco.faixas} />
    </ChartCard>
  );
}

/** "Evolução por ciclo" / "Evolução do índice". Só desenha com 2+ pontos: uma
 *  linha de um ponto só não é tendência, é um ponto. */
function EvolucaoCard({
  title, description, bloco, nomeSerie, cor, motivoSemDado,
}: { title: string; description: string; bloco: BlocoEvolucao | null; nomeSerie: string; cor: string; motivoSemDado: string }) {
  if (!bloco || bloco.rotulos.length < 2) {
    return <SemFonteCard title={title} description={description} motivo={motivoSemDado} />;
  }
  return (
    <ChartCard title={title} description={description} source={bloco.fonte}>
      <GraficoLinha rotulos={bloco.rotulos} series={[{ nome: nomeSerie, cor, pontos: bloco.valores }]} max={100} />
    </ChartCard>
  );
}

function AlertasPrioritariosCard({ alertas, carregando, irParaPlano }: { alertas: Alerta[]; carregando: boolean; irParaPlano: () => void }) {
  return (
    <div className="card">
      <div className="card__head">
        <div>
          <h3>Alertas prioritários</h3>
          <span className="card__sub">Ações vencidas e ações aprovadas sem responsável, prazo ou evidência.</span>
        </div>
        <button className="btn btn--outline-dark btn--sm" onClick={irParaPlano}>Plano de Evolução</button>
      </div>
      {carregando ? (
        <p className="dash-state" style={{ margin: 0 }}>Carregando…</p>
      ) : alertas.length === 0 ? (
        <p className="dash-state" style={{ margin: 0 }}>
          Nenhum alerta: nenhuma ação aprovada está vencida ou incompleta.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
          {alertas.map((a) => (
            <li
              key={a.id}
              style={{
                display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start",
                border: "1px solid var(--line)", borderLeft: `3px solid ${a.atraso === null ? "var(--gold)" : "var(--danger)"}`,
                borderRadius: 8, padding: "9px 11px",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.titulo}</div>
                <div className="card__sub" style={{ fontSize: 10.5 }}>{a.detalhe}</div>
              </div>
              <span className={`pill pill--sm ${a.atraso === null ? "pill--gold" : "pill--danger"}`} style={{ flexShrink: 0 }}>
                {a.atraso === null ? "incompleta" : `${a.atraso}d atraso`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AcoesPrioritariasCard({ acoes, plans, irParaPlano }: { acoes: AcaoPrioritaria[]; plans: ActionPlanData[] | null; irParaPlano: () => void }) {
  return (
    <div className="card">
      <div className="card__head">
        <div>
          <h3>Ações prioritárias</h3>
          <span className="card__sub">As 5 ações aprovadas com o prazo mais próximo.</span>
        </div>
        <button className="btn btn--outline-dark btn--sm" onClick={irParaPlano}>Ver todas</button>
      </div>
      {plans === null ? (
        <p className="dash-state" style={{ margin: 0 }}>Carregando…</p>
      ) : acoes.length === 0 ? (
        <p className="dash-state" style={{ margin: 0 }}>
          Nenhuma ação aprovada em aberto. As sugestões entram aqui depois de aprovadas no Plano de Evolução.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
          {acoes.map((a) => (
            <li
              key={a.id}
              style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 11px" }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.titulo}</div>
                <div className="card__sub" style={{ fontSize: 10.5 }}>{a.detalhe}</div>
              </div>
              <span className="pill pill--sm" style={{ flexShrink: 0 }}>{ACTION_STATUS_LABEL[a.status] ?? a.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RelatoriosRecentesCard({ emissoes, irParaDocumentos }: { emissoes: ReportEmissionMeta[] | null; irParaDocumentos: () => void }) {
  return (
    <div className="card">
      <div className="card__head">
        <div>
          <h3>Relatórios recentes</h3>
          <span className="card__sub">Emissões oficiais — cada uma com número sequencial e hash do conteúdo.</span>
        </div>
        <button className="btn btn--outline-dark btn--sm" onClick={irParaDocumentos}>Ver todos</button>
      </div>
      {emissoes === null ? (
        <p className="dash-state" style={{ margin: 0 }}>Carregando…</p>
      ) : emissoes.length === 0 ? (
        <p className="dash-state" style={{ margin: 0 }}>
          Nenhum relatório emitido ainda. A emissão libera quando a campanha é encerrada e o Plano de Evolução é validado.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
          {emissoes.slice(0, 5).map((e) => (
            <li
              key={e.id}
              style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 11px" }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</div>
                <div className="card__sub" style={{ fontSize: 10.5 }}>
                  {new Date(e.createdAt).toLocaleDateString("pt-BR")} · {e.status.toLowerCase()} · hash {e.contentHash.slice(0, 8)}
                </div>
              </div>
              <span className="pill pill--sm pill--outline" style={{ flexShrink: 0 }}>v{e.emissionNumber}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Fileira executiva do mockup do Portal (22/07): 6 KPIs com DADOS REAIS —
 * participação do diagnóstico organizacional, riscos altos derivados da matriz
 * Severidade × Probabilidade (doc 09 §6), execução do plano, evidências e
 * documentos liberados pelo contrato. Sem número inventado: célula sem dado
 * mostra "—" e explica a origem.
 */
function ExecutiveKpiRow({ plans, diag, psy, docs, cobertura }: { plans: ActionPlanData[] | null; diag: DashboardDiagnostic | null; psy: PsychosocialResults | null; docs: DocumentDescriptor[] | null; cobertura: { percent: number; convidados: number; respondidos: number } | null }) {
  const docsAvail = docs ? docs.filter((x) => x.available).length : null;
  const docsTotal = docs ? docs.length : null;

  const items = plans?.flatMap((p) => p.items) ?? [];
  const highRisks = items.filter((i) => {
    const sev = i.severity as RiskLevel3 | null;
    const prob = i.probability as RiskLevel3 | null;
    if (sev && prob && RISK_LEVELS_3.includes(sev) && RISK_LEVELS_3.includes(prob)) {
      return classifyTechnicalRisk(prob, sev) === "Alto";
    }
    return i.riskLevel === "ALTO" || i.riskLevel === "CRITICO";
  }).length;
  const emAndamento = items.filter((i) => i.status === "EM_ANDAMENTO" || i.status === "APROVADA").length;
  const concluidas = items.filter((i) => i.status === "CONCLUIDA").length;
  const evidencias = items.reduce((n, i) => n + i.evidences.length, 0);
  // A participacao tem de vir do motor que a empresa contratou. Lendo so o
  // psicossocial, o tenant do Essencial via "Participacao 0" a dois cards de
  // distancia do card que dizia "Respondentes 12" — a mesma tela se contradizia.
  const doMotor = diag?.engine === "DIAGNOSTICS" ? diag.aggregate : null;
  const setores = doMotor ? null : psy ? psy.sectors.length : null;
  const respondentes = doMotor ? doMotor.totalRespondents : psy ? psy.totalRespondents : null;
  const nomeDoDiagnostico = doMotor
    ? diag?.instrumentName ?? "diagnóstico contratado"
    : "diagnóstico organizacional";

  const cells: { label: string; value: string; sub: string; hint: string }[] = [
    // Cobertura ≠ Participação: participação é quanta gente respondeu;
    // cobertura é quanta gente respondeu DENTRE OS CONVIDADOS. É a cobertura
    // que a fiscalização olha — coleta de 19 pessoas num universo de 200 não
    // cobre a organização.
    {
      label: "Cobertura",
      value: cobertura === null ? "—" : `${cobertura.percent}%`,
      sub: cobertura === null ? "nenhum convite emitido ainda" : `${cobertura.respondidos} de ${cobertura.convidados} convidado(s)`,
      hint: "Respondidos ÷ convidados no ciclo mais recente. Sem convites emitidos não há cobertura a medir.",
    },
    {
      label: "Participação",
      value: respondentes === null ? "—" : String(respondentes),
      // Recorte por setor so existe no motor psicossocial; nos demais o numero
      // nao aparece em vez de virar um zero que parece resultado.
      sub: setores === null ? `respondentes · ${nomeDoDiagnostico}` : `respondentes · ${setores} setor(es) avaliado(s)`,
      hint: "Respostas válidas de colaboradores no diagnóstico contratado. A autoavaliação do gestor fica à parte.",
    },
    {
      label: "Riscos altos",
      value: plans ? String(highRisks) : "—",
      sub: "matriz Severidade × Probabilidade",
      hint: "Ações cujo fator caiu na faixa Alto da matriz S × P. Não é contagem de pessoas.",
    },
    {
      label: "Ações em andamento",
      value: plans ? String(emAndamento) : "—",
      sub: `${concluidas} concluída(s)`,
      hint: "Ações aprovadas ou em execução no Plano de Evolução. Sugestões pendentes de decisão não entram.",
    },
    {
      label: "Evidências",
      value: plans ? String(evidencias) : "—",
      sub: "vinculadas às ações do plano",
      hint: "Arquivos e registros anexados às ações — é o que sustenta o plano numa fiscalização.",
    },
    {
      label: "Relatórios",
      value: docsAvail === null ? "—" : String(docsAvail),
      sub: docsTotal === null || docsAvail === null
        ? "documentos do contrato"
        : `${docsTotal - docsAvail} bloqueado(s) por gate`,
      hint: "Documentos do contrato liberados para gerar. Um documento bloqueado espera um gate (campanha encerrada, plano validado).",
    },
  ];

  return (
    <div className="exec-kpis">
      {cells.map((c) => (
        <div className="kpi" key={c.label} title={c.hint}>
          <span className="kpi__label">{c.label}</span>
          <span className="kpi__value">{c.value}</span>
          <span className="kpi__sub">{c.sub}</span>
        </div>
      ))}
    </div>
  );
}

export function DashboardScreen() {
  const { data, status, refresh } = useIcdDashboard();
  const { data: axesData, status: axesStatus } = useIcdAxes();
  const [plans, setPlans] = useState<ActionPlanData[] | null>(null);
  // Resultado do diagnóstico CONTRATADO. Fica fora do gate de status do
  // /icd/dashboard de propósito: era o dado que a empresa mais procurava e ele
  // não podia sumir junto com os indicadores quando aquele endpoint falha.
  const [diag, setDiag] = useState<DashboardDiagnostic | null>(null);
  const [diagErro, setDiagErro] = useState(false);
  // Módulos CONTRATADOS (tenant_modules). A Visão Geral mostrava a camada de
  // Liderança/ICD — Índice via ICD, "Líderes elegíveis", Coerência Decisória,
  // 4 Rs, frase §11 — para toda empresa, inclusive quem contratou só o
  // Diagnóstico Essencial (homologação 17/09: "módulos/conceitos não
  // contratados"). null = ainda não carregou → a camada fica escondida até a
  // prova positiva; falha na chamada também esconde (não mostrar o que não foi
  // contratado é o lado seguro).
  const [modules, setModules] = useState<Set<string> | null>(null);
  // Resultado do motor psicossocial (Organizacional) — buscado UMA vez aqui e
  // passado aos cards (antes cada card fazia a própria chamada ao mesmo endpoint).
  const [psy, setPsy] = useState<PsychosocialResults | null>(null);
  // Aba visível (Panorama/Diagnósticos/Execução) — o desenho do protótipo.
  const [aba, setAba] = useState<Aba>("panorama");
  // Documentos do contrato e emissões oficiais: subiram do card para cá porque
  // KPI, card de relatórios e exportação precisam do MESMO número.
  const [docs, setDocs] = useState<DocumentDescriptor[] | null>(null);
  const [emissoes, setEmissoes] = useState<ReportEmissionMeta[] | null>(null);
  // Campanhas dão a COBERTURA (respondidos ÷ convidados) e a única série
  // temporal que existe do lado do diagnóstico; o histórico de ICD dá a outra.
  const [campanhas, setCampanhas] = useState<CampaignSummary[] | null>(null);
  const [icdHist, setIcdHist] = useState<IcdCycleHistoryEntry[] | null>(null);
  const [hojeMs, setHojeMs] = useState(0);
  useEffect(() => {
    let vivo = true;
    setHojeMs(Date.now());
    listDocuments().then((d) => { if (vivo) setDocs(d); }).catch(() => { if (vivo) setDocs([]); });
    listReportEmissions().then((e) => { if (vivo) setEmissoes(e); }).catch(() => { if (vivo) setEmissoes([]); });
    listCampaigns().then((c) => { if (vivo) setCampanhas(c); }).catch(() => { if (vivo) setCampanhas([]); });
    // 403 aqui é módulo Liderança não contratado — ausência, não falha.
    getIcdHistory().then((h) => { if (vivo) setIcdHist(h); }).catch(() => { if (vivo) setIcdHist([]); });
    return () => { vivo = false; };
  }, []);
  useEffect(() => {
    let vivo = true;
    getMyModules()
      .then((m) => { if (vivo) setModules(new Set(m)); })
      .catch(() => { if (vivo) setModules(new Set()); });
    getPsychosocialResults().then((r) => { if (vivo) setPsy(r); }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  const icdContratado = modules?.has("icd") ?? false;
  const govIaContratado = modules?.has("govia") ?? false;

  const carregarDiag = useCallback(() => {
    let vivo = true;
    getDashboardDiagnostic()
      .then((d) => { if (vivo) { setDiag(d); setDiagErro(false); } })
      .catch(() => { if (vivo) { setDiag(null); setDiagErro(true); } });
    return () => { vivo = false; };
  }, []);

  useEffect(() => carregarDiag(), [carregarDiag]);

  const atualizarTudo = () => { refresh(); carregarDiag(); };

  useEffect(() => {
    let alive = true;
    listActionPlans()
      .then((p) => { if (alive) setPlans(p); })
      .catch(() => { if (alive) setPlans([]); });
    return () => { alive = false; };
  }, []);

  const planStats = plans ? computePlanStats(plans) : null;

  // ICD agregado (camada complementar) — com supressão §11. Só existe para
  // quem contratou o módulo; sem ele, nada de ICD entra em nenhum card.
  const icdScore = icdContratado && status === "ok" ? data?.icdMedio ?? null : null;
  const leadersN = icdContratado && status === "ok" ? data?.totalLideres ?? 0 : 0;
  const icdSuppressed = leadersN > 0 && leadersN < MIN_LEADERS_FOR_DISCLOSURE;
  const icdBand = icdScore !== null ? getIcdMaturityBand(icdScore) : null;
  // #17 — estado vazio profissional: sem ICD e sem plano = nenhum diagnóstico concluído ainda.
  const temResultado = !!diag?.aggregate && diag.aggregate.totalRespondents > 0;
  // Índice Geral CRIVO = índice do diagnóstico CONTRATADO (motor de
  // diagnósticos), não mais o ICD como "proxy temporário": a empresa do
  // Essencial tinha score 69,6 no card de resultado e "Pendente: aplique o
  // Diagnóstico CRIVO" no card de cima da mesma tela.
  // Motor de diagnósticos (Essencial etc.): agregado do /dashboard/diagnostic.
  // Motor psicossocial (Organizacional): score geral do /psychosocial/results.
  // Sem nenhum dos dois, o ICD (se contratado) é o que resta.
  const agg = diag?.engine === "DIAGNOSTICS" && temResultado && !diag!.aggregate!.suppressed ? diag!.aggregate! : null;
  const psyGeral = diag?.engine === "PSYCHOSOCIAL" && psy && psy.totalRespondents > 0 && !psy.overall.suppressed ? psy.overall : null;
  const indiceGeral: number | null =
    agg?.score != null ? agg.score : psyGeral ? psyGeral.score : icdScore;
  const indiceFaixa: string | null =
    agg?.score != null
      ? agg.levelLabel ?? null
      : psyGeral
        ? PSYCHOSOCIAL_RISK_LABEL[psyGeral.level] ?? psyGeral.level
        : icdBand?.label ?? null;
  const indiceRespondentes: number | null = agg ? agg.totalRespondents : psyGeral ? psy!.totalRespondents : null;
  // Nível de atenção acompanha o índice: a faixa do Motor quando existe,
  // senão a régua fixa (crítico < 50 ≤ em atenção < 75 ≤ equilíbrio).
  const orgAttention = indiceFaixa && indiceGeral !== null
    ? { label: indiceFaixa, tone: attention(indiceGeral).tone }
    : attention(indiceGeral);
  // Sem isto a tela mostrava "Nenhum diagnostico concluido ainda" logo abaixo do
  // card com indice e respondentes.
  const isEmpty = icdScore === null && (!plans || plans.length === 0) && !temResultado;
  const goToRoute = (route: string) =>
    document.querySelector<HTMLElement>(`[data-route="${route}"]`)?.click();

  // ── Blocos portados do protótipo ──
  const fatores = useMemo(() => montarFatores(psy, diag), [psy, diag]);
  const porFator = useMemo(() => montarDistribuicaoPorFator(psy), [psy]);
  const cobertura = useMemo(() => montarCobertura(campanhas), [campanhas]);
  const evolCobertura = useMemo(() => montarEvolucaoCobertura(campanhas), [campanhas]);
  const evolIcd = useMemo(() => montarEvolucaoIcd(icdHist), [icdHist]);
  const radarIcd = useMemo(() => montarRadarIcd(axesData?.company?.axesAverage), [axesData]);
  const distribuicao = useMemo(() => montarDistribuicao(psy, diag), [psy, diag]);
  const alertas = useMemo(() => (hojeMs ? montarAlertas(plans, hojeMs) : []), [plans, hojeMs]);
  const acoesPrioritarias = useMemo(() => montarAcoesPrioritarias(plans), [plans]);

  // Exportação XLSX/PDF — os dois botões que o protótipo tem no cabeçalho.
  // Usa o helper compartilhado do portal (lib/exports), que já carimba empresa,
  // unidade, ciclo e contratação reais no cabeçalho do arquivo.
  const exportCtx = useExportContext();
  const [exportando, setExportando] = useState<"xlsx" | "pdf" | null>(null);

  function linhasKpi(): Record<string, unknown>[] {
    return [
      { Indicador: "Índice Geral CRIVO", Valor: indiceGeral ?? "—", Faixa: indiceFaixa ?? "—" },
      { Indicador: "Nível de Atenção Organizacional", Valor: orgAttention.label, Faixa: "" },
      { Indicador: "Respondentes", Valor: indiceRespondentes ?? "—", Faixa: "" },
      { Indicador: "Ações aprovadas em aberto", Valor: planStats ? planStats.open : "—", Faixa: "" },
      { Indicador: "Ações concluídas", Valor: planStats ? planStats.done : "—", Faixa: "" },
      { Indicador: "Relatórios emitidos", Valor: emissoes ? emissoes.length : "—", Faixa: "" },
    ];
  }
  function linhasFatores(): Record<string, unknown>[] {
    return (fatores?.linhas ?? []).map((l) => ({ Fator: l.rotulo, Valor: l.valor, Classificação: l.nota }));
  }
  function linhasDistribuicao(): Record<string, unknown>[] {
    return (distribuicao?.fatias ?? []).map((f) => ({ Faixa: f.rotulo, Quantidade: f.valor }));
  }
  function linhasAcoes(): Record<string, unknown>[] {
    return acoesPrioritarias.map((a) => ({ Ação: a.titulo, Detalhe: a.detalhe, Status: ACTION_STATUS_LABEL[a.status] ?? a.status }));
  }
  function linhasAlertas(): Record<string, unknown>[] {
    return alertas.map((a) => ({ Ação: a.titulo, Detalhe: a.detalhe, Situação: a.atraso === null ? "incompleta" : `${a.atraso} dia(s) de atraso` }));
  }
  function linhasRelatorios(): Record<string, unknown>[] {
    return (emissoes ?? []).map((e) => ({
      Relatório: e.title,
      Versão: e.emissionNumber,
      Emitido: new Date(e.createdAt).toLocaleDateString("pt-BR"),
      Status: e.status,
      Hash: e.contentHash.slice(0, 12),
    }));
  }

  async function exportar(tipo: "xlsx" | "pdf") {
    if (!exportCtx) return;
    setExportando(tipo);
    try {
      if (tipo === "xlsx") {
        const abas: ExportSheet[] = [
          { name: "Indicadores", rows: linhasKpi() },
          { name: fatores?.titulo ?? "Fatores prioritários", rows: linhasFatores() },
          { name: "Distribuição de risco", rows: linhasDistribuicao() },
          { name: "Ações prioritárias", rows: linhasAcoes() },
          { name: "Alertas", rows: linhasAlertas() },
          { name: "Relatórios emitidos", rows: linhasRelatorios() },
        ];
        await exportXLSX("crivo-visao-geral", abas, exportCtx);
      } else {
        const secoes: ExportSection[] = [
          { heading: "Indicadores do ciclo", rows: linhasKpi() },
          { heading: fatores?.titulo ?? "Fatores prioritários", rows: linhasFatores() },
          { heading: "Distribuição de risco", rows: linhasDistribuicao() },
          { heading: "Ações prioritárias", rows: linhasAcoes() },
          { heading: "Alertas prioritários", rows: linhasAlertas() },
          { heading: "Relatórios emitidos", rows: linhasRelatorios() },
        ];
        await exportPDF("crivo-visao-geral", "Visão Geral Executiva", secoes, exportCtx);
      }
    } finally {
      setExportando(null);
    }
  }

  const subtitulo = icdContratado
    ? "Diagnóstico organizacional, plano de ação e camada complementar de coerência decisória."
    : "Diagnóstico organizacional e plano de ação.";

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Visão Geral Executiva</h1>
          <p className="page-sub">{subtitulo}</p>
        </div>
        <div className="route__actions" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            className="btn btn--outline-dark btn--sm"
            onClick={() => exportar("xlsx")}
            disabled={!exportCtx || !!exportando}
            title={!exportCtx ? "Carregando identificação da empresa…" : "Exportar indicadores, fatores, ações e relatórios em Excel"}
          >
            <IconDownload /> {exportando === "xlsx" ? "Gerando…" : "XLSX"}
          </button>
          <button
            className="btn btn--outline-dark btn--sm"
            onClick={() => exportar("pdf")}
            disabled={!exportCtx || !!exportando}
            title={!exportCtx ? "Carregando identificação da empresa…" : "Exportar a Visão Geral em PDF"}
          >
            <IconFileText /> {exportando === "pdf" ? "Gerando…" : "PDF"}
          </button>
          <button className="btn btn--outline-dark btn--sm" onClick={atualizarTudo} disabled={status === "loading"}>
            <IconRefresh /> {status === "loading" ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>

      {/* Fileira executiva (mockup 22/07) — 6 KPIs reais no topo, acima das abas:
          é o resumo que vale para as três. */}
      <ExecutiveKpiRow plans={plans} diag={diag} psy={psy} docs={docs} cobertura={cobertura} />

      {diagErro && (
        <p className="dash-state">
          Não foi possível carregar o resultado do diagnóstico. Use <strong>Atualizar</strong>.
        </p>
      )}

      {status === "loading" && <p className="dash-state">Carregando indicadores…</p>}

      {status === "error" && (
        <div className="dash-state dash-state--error">
          Não foi possível carregar o dashboard.{" "}
          <button className="btn btn--outline-dark btn--sm" onClick={refresh}>Tentar novamente</button>
        </div>
      )}

      {status === "ok" && (
        <>
          {/* Abas Panorama / Diagnósticos / Execução — o desenho do protótipo.
              Antes tudo isto era uma coluna só, e o cliente rolava a tela inteira
              para chegar no plano de ação. */}
          <div className="seg" style={{ flexWrap: "wrap", marginBottom: 16 }}>
            {ABAS.map(([chave, rotulo]) => (
              <button
                key={chave}
                type="button"
                className={`seg__btn${aba === chave ? " is-active" : ""}`}
                onClick={() => setAba(chave)}
              >
                {rotulo}
              </button>
            ))}
          </div>

          {/* ══════════════════ PANORAMA ══════════════════ */}
          {aba === "panorama" && (
            <>
              {/* Duas fileiras de 3 cards, na ordem do protótipo. Ficam ANTES do
                  checklist e dos KPIs do portal porque é o que o cliente olha
                  primeiro — e é o que ele comparou com o protótipo. */}
              <div className="grid grid--3">
                <EvolucaoCard
                  title="Evolução por ciclo"
                  description="Cobertura de cada ciclo de diagnóstico encerrado."
                  bloco={evolCobertura}
                  nomeSerie="Cobertura (%)"
                  cor={COR_SERIE.azul}
                  motivoSemDado="A curva compara ciclos ENCERRADOS. Com um ciclo só ainda não há tendência — ela aparece quando o segundo for fechado. O risco agregado por ciclo, que o protótipo também traça, depende de um retrato do índice que a plataforma ainda não guarda."
                />
                <FatoresPrioritariosCard
                  bloco={fatores}
                  acoes={
                    <button
                      className="btn btn--outline-dark btn--sm"
                      onClick={() => goToRoute(diag?.engine === "DIAGNOSTICS" ? "essencial" : "psicossocial")}
                    >
                      Detalhes
                    </button>
                  }
                />
                <DistribuicaoPorFatorCard bloco={porFator} />
              </div>

              <div className="grid grid--3" style={{ marginTop: 16 }}>
                <DistribuicaoRiscoCard bloco={distribuicao} />
                <SemFonteCard
                  title="Inteligência CRIVO · destaques"
                  description="Leituras derivadas do diagnóstico, marcadas como fato, inferência ou hipótese."
                  motivo="Ainda não habilitado neste contrato. Enquanto isso, a leitura interpretada do ciclo sai no Parecer CRIVO e no Dossiê."
                />
                <AlertasPrioritariosCard alertas={alertas} carregando={plans === null || hojeMs === 0} irParaPlano={() => goToRoute("relatorios")} />
              </div>

              {/* #65 — Checklist de onboarding (some quando tudo está done). */}
              <OnboardingChecklist />

              {/* Fase 3 §12 — Notificações & travas operacionais (some quando não há pendências). */}
              <OperationalAlerts />

              {/* #17 — Estado vazio profissional enquanto não há diagnóstico concluído. */}
              {isEmpty && (
                <div className="dash-empty">
                  <span className="dash-empty__ic" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M3 13.5 9 18l12-12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <h2 className="dash-empty__title">Nenhum diagnóstico concluído ainda</h2>
                  <p className="dash-empty__sub">
                    Inicie o diagnóstico para visualizar indicadores, plano de ação e evidências.
                  </p>
                  <button className="btn btn--terra btn--sm" onClick={() => goToRoute("essencial")}>
                    Iniciar diagnóstico
                  </button>
                </div>
              )}

              {/* ─── CARDS PRINCIPAIS (Diagnóstico + Plano de Ação) ─────────── */}
              <div className="kpi-grid">
                <div className="kpi">
                  <span className="kpi__label">Índice Geral CRIVO</span>
                  {indiceGeral === null ? (
                    <>
                      <strong className="kpi__value">—</strong>
                      <span className="kpi__delta">
                        {temResultado && diag?.aggregate?.suppressed
                          ? "Protegido: abaixo do mínimo de respondentes."
                          : "Pendente: aplique o diagnóstico contratado para gerar o índice."}
                      </span>
                    </>
                  ) : (
                    <>
                      <strong className="kpi__value">{indiceGeral}<small> /100</small></strong>
                      {indiceFaixa && <span className="pill pill--gold" style={{ marginTop: 4 }}>{indiceFaixa}</span>}
                      <div className="kpi__bar" style={{ marginTop: 6 }}>
                        <div style={{ width: `${Math.max(0, Math.min(100, indiceGeral))}%` }} />
                      </div>
                      {indiceRespondentes !== null && (
                        <span className="kpi__delta">
                          {indiceRespondentes} respondente(s){diag?.instrumentName ? ` · ${diag.instrumentName}` : ""}
                        </span>
                      )}
                    </>
                  )}
                </div>

                <div className="kpi">
                  <span className="kpi__label">Nível de Atenção Organizacional</span>
                  <strong className={`kpi__value dash-attn dash-attn--${orgAttention.tone}`}>
                    {orgAttention.label}
                  </strong>
                  <span className="kpi__delta">
                    {orgAttention.tone === "crit" && "Fragilidades relevantes — ação executiva recomendada."}
                    {orgAttention.tone === "alert" && "Pontos de atenção para reduzir retrabalho e desalinhamento."}
                    {orgAttention.tone === "ok" && "Boa qualidade decisória e condições de implementação."}
                    {orgAttention.tone === "na" && "Aplique o diagnóstico para ler o nível de atenção."}
                  </span>
                </div>

                <div className="kpi">
                  <span className="kpi__label">Plano de Ação &amp; Evidências</span>
                  {planStats === null ? (
                    <span className="kpi__delta">Carregando…</span>
                  ) : (() => {
                    // "Aberta" é ação DECIDIDA (aprovada/em andamento/reavaliada);
                    // sugestão pendente é outra coisa e sai separada — "12 abertas"
                    // com zero aprovadas lia como plano em execução.
                    const sugeridas = (planStats.byStatus.SUGERIDA ?? 0) + (planStats.byStatus.EM_REVISAO ?? 0);
                    const abertas = Math.max(0, planStats.open - sugeridas);
                    return (
                      <>
                        <strong className="kpi__value">
                          {abertas}
                          <small> aprovada{abertas === 1 ? "" : "s"} em aberto</small>
                        </strong>
                        <span className="kpi__delta">
                          {planStats.done} concluída{planStats.done === 1 ? "" : "s"}
                          {sugeridas > 0 ? ` · ${sugeridas} sugestão(ões) aguardando decisão` : ""}
                        </span>
                      </>
                    );
                  })()}
                </div>

                {icdContratado && (
                  <div className="kpi">
                    <span className="kpi__label">Líderes elegíveis</span>
                    <strong className="kpi__value">{leadersN}</strong>
                    <span className="kpi__delta">
                      {icdSuppressed
                        ? `Volume mínimo: ${MIN_LEADERS_FOR_DISCLOSURE} (§11)`
                        : leadersN === 0
                          ? "Aguardando primeiras avaliações."
                          : "Ciclo em andamento."}
                    </span>
                  </div>
                )}
              </div>

            </>
          )}

          {/* ══════════════════ DIAGNÓSTICOS ══════════════════ */}
          {aba === "diagnosticos" && (
            <>
              {/* Fileira do protótipo. "Prontidão para IA" e o radar do ICD só
                  aparecem como programa CONTRATADO: mostrar módulo que a empresa
                  não comprou foi apontado na homologação de 17/09. */}
              <div className="grid grid--3" style={{ marginBottom: 16 }}>
                <EvolucaoCard
                  title="Evolução do índice"
                  description="Tendência do índice consolidado entre ciclos fechados."
                  bloco={evolIcd}
                  nomeSerie="ICD da empresa"
                  cor={COR_SERIE.gold}
                  motivoSemDado="A plataforma não guarda retrato do índice do diagnóstico por ciclo — a curva exige criar esse histórico na API. Hoje a única série fechada é a do ICD trimestral, e ela precisa de dois ciclos encerrados."
                />
                <SemFonteCard
                  title="Prontidão para IA"
                  description="Índice por dimensão de maturidade (0–100)."
                  motivo={govIaContratado
                    ? "O módulo Governança de IA registra casos de uso, riscos, decisões e incidentes — ainda não há um questionário de maturidade que produza índice por dimensão."
                    : "Programa Governança de IA não contratado. O índice aparece aqui quando o módulo for liberado no contrato."}
                />
                {icdContratado && radarIcd ? (
                  <ChartCard
                    title="Liderança · ICD agregado"
                    description="Agregado, sem individualização. Escala 0–100."
                    source={`4 Eixos do ciclo aberto · ${axesData?.company?.eligibleLeaders ?? 0} líder(es) elegível(is) · supressão §11`}
                    actions={<button className="btn btn--outline-dark btn--sm" onClick={() => goToRoute("icd")}>Detalhes</button>}
                  >
                    <GraficoRadar eixos={radarIcd} max={100} />
                  </ChartCard>
                ) : (
                  <SemFonteCard
                    title="Liderança · ICD agregado"
                    description="Agregado dos 4 Eixos, sem individualização (§11)."
                    motivo={icdContratado
                      ? "Nenhum ciclo trimestral com decisões avaliadas ainda, ou volume abaixo do mínimo de líderes para liberar o agregado (§11)."
                      : "Programa Liderança (ICD) não contratado. Os eixos aparecem aqui quando o módulo for liberado no contrato."}
                  />
                )}
              </div>

              {/* O resultado das respostas dos colaboradores. Só aparece no motor de
                  diagnósticos: no psicossocial quem mostra é o card "Fatores
                  Psicossociais", logo abaixo — o mesmo número duas vezes na tela
                  confunde mais do que informa. */}
              {diag?.engine === "DIAGNOSTICS" && diag.aggregate && diag.aggregate.totalRespondents > 0 && (
                <ResultadoDiagnosticoCard
                  data={diag.aggregate}
                  title="Resultado do diagnóstico (colaboradores)"
                  subtitle={
                    <>
                      Respostas anônimas e agregadas
                      {diag.instrumentName ? <> do <strong>{diag.instrumentName}</strong></> : null}.
                      A autoavaliação do gestor não entra: fica à parte, na página do diagnóstico.
                    </>
                  }
                />
              )}

              {/* ─── PROPRIEDADES ORGANIZACIONAIS (sumário §7) ───────────────── */}
              {/* "Sustentação Organizacional" era um placeholder fixo ("disponível
                  após a campanha") que continuava na tela DEPOIS da campanha, ao
                  lado do resultado por dimensão. Só faz sentido enquanto não há
                  resultado — com resultado, a leitura por dimensão está no card
                  "Resultado do diagnóstico" acima. */}
              {(!temResultado || diag?.engine !== "DIAGNOSTICS") && (
                <div className="grid grid--2" style={{ marginTop: 16 }}>
                  {!temResultado && (
                    <div className="card">
                      <div className="card__head">
                        <div>
                          <h3>Sustentação Organizacional</h3>
                          <span className="card__sub">Clareza, demandas, autonomia, comunicação, previsibilidade e rotina.</span>
                        </div>
                      </div>
                      <p className="dash-state" style={{ margin: 0 }}>
                        Disponível após aplicação da <strong>Campanha de Diagnóstico</strong>.
                        A leitura por dimensão fica vinculada ao ciclo e respeita o mínimo de respondentes por recorte.
                      </p>
                    </div>
                  )}

                  <FatoresPsicossociaisCard diag={diag} psy={psy} />
                </div>
              )}

              {/* ─── CAMADA COMPLEMENTAR — Coerência Decisória (ICD) ─────────── */}
              {/* Só para quem contratou o programa Liderança (módulo "icd"). */}
              {icdContratado && (
                <div className="card" style={{ marginTop: 16, borderTop: "3px solid var(--gold-soft)" }}>
                  <div className="card__head">
                    <div>
                      <h3>Coerência Decisória da Liderança <span className="pill" style={{ marginLeft: 8, verticalAlign: "middle" }}>Camada complementar</span></h3>
                      <span className="card__sub">
                        Indicadores AGREGADOS do Radar da Decisão / ICD. Não compõe o Índice Geral CRIVO. Não exibe ranking individual (§11).
                      </span>
                    </div>
                  </div>

                  {/* ── 4 EIXOS (modelo OFICIAL) — Clareza/Critério/Alinhamento/Sustentação ── */}
                  <IcdAxesOfficial axes={axesData} status={axesStatus} />

                  {/* ── 4 Rs (modelo LEGADO · diagnóstico de tensão · histórico) ── */}
                  <h4 className="eixos-legacy-h">
                    Modelo legado · 4 Rs <span className="card__sub" style={{ fontWeight: 400 }}>— diagnóstico de tensão (histórico)</span>
                  </h4>

                  {leadersN === 0 ? (
                    <p className="dash-state" style={{ margin: 0 }}>
                      Nenhuma avaliação registrada no ciclo. Quando os líderes responderem, os indicadores aparecem aqui.
                    </p>
                  ) : icdSuppressed ? (
                    <p className="dash-state" style={{ margin: 0 }}>
                      Dados insuficientes para preservar a confidencialidade (mínimo {MIN_LEADERS_FOR_DISCLOSURE} respondentes — §11).
                      Atualmente {leadersN} líder{leadersN === 1 ? "" : "es"}.
                    </p>
                  ) : data && (
                    <>
                      <div className="dash-dist" style={{ marginBottom: 14 }}>
                        {Object.entries(data.distribuicaoPadrao).map(([p, n]) => (
                          <span key={p} className="dash-dist__item">
                            {PATTERN_LABEL[p] ?? p}: <strong>{n}</strong>
                          </span>
                        ))}
                      </div>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Dimensão (modelo legado · 4 Rs)</th>
                            <th>Coerência média</th>
                          </tr>
                        </thead>
                        <tbody>
                          {DIMENSIONS.map((d) => (
                            <tr key={d}>
                              <td>{DIMENSION_LABEL[d] ?? d}</td>
                              <td>
                                <strong className={`dash-score ${scoreClass(data.dimensionAverages?.[d] ?? 0)}`}>
                                  {data.dimensionAverages?.[d] ?? 0}
                                </strong>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="card__sub" style={{ marginTop: 10 }}>
                        Os <strong>4 Rs</strong> medem a <strong>tensão</strong> sob pressão (diagnóstico legado). O{" "}
                        <strong>ICD oficial</strong> usa os <strong>4 Eixos</strong> acima, medidos por decisão real ao longo do
                        ciclo trimestral.
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* ─── FRASE OBRIGATÓRIA DE GOVERNANÇA (Anexo ICD §11) ─────────── */}
              {icdContratado && (
                <p className="dash-privacy" role="note">
                  <strong>Governança ICD · §11 — </strong>{PORTAL_S11}
                </p>
              )}
            </>
          )}

          {/* ══════════════════ EXECUÇÃO ══════════════════ */}
          {aba === "execucao" && (
            <>
              <div className="grid grid--2">
                <AcoesPrioritariasCard acoes={acoesPrioritarias} plans={plans} irParaPlano={() => goToRoute("relatorios")} />
                <RelatoriosRecentesCard emissoes={emissoes} irParaDocumentos={() => goToRoute("documentos")} />
              </div>

              {/* ─── GOVERNANÇA E PLANO DE AÇÃO ──────────────────────────────── */}
              <div className="card" style={{ marginTop: 16 }}>
                <div className="card__head">
                  <div>
                    <h3>Governança e Plano de Ação</h3>
                    <span className="card__sub">Responsáveis, prazos, status, evidências e acompanhamento.</span>
                  </div>
                </div>
                {planStats === null ? (
                  <p className="dash-state" style={{ margin: 0 }}>Carregando planos…</p>
                ) : planStats.total === 0 ? (
                  <p className="dash-state" style={{ margin: 0 }}>
                    Nenhuma ação registrada ainda. Quando uma campanha for validada, as ações sugeridas aparecem aqui.
                  </p>
                ) : (
                  <>
                    <div className="dash-dist" style={{ marginBottom: 12 }}>
                      {(Object.entries(planStats.byStatus) as [ActionStatus, number][]).map(([st, n]) => (
                        <span key={st} className="dash-dist__item">
                          {ACTION_STATUS_LABEL[st]}: <strong>{n}</strong>
                        </span>
                      ))}
                    </div>
                    {planStats.latest.length > 0 && (
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Plano</th>
                            <th>Ações</th>
                            <th>Validado em</th>
                          </tr>
                        </thead>
                        <tbody>
                          {planStats.latest.map((p) => (
                            <tr key={p.id}>
                              <td>{p.title}</td>
                              <td>{p.items.length}</td>
                              <td>
                                {p.validatedAt
                                  ? new Date(p.validatedAt).toLocaleDateString("pt-BR")
                                  : <span className="card__sub">Pendente</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </>
                )}
              </div>

              <div style={{ marginTop: 16 }}>
                <AlertasPrioritariosCard alertas={alertas} carregando={plans === null || hojeMs === 0} irParaPlano={() => goToRoute("relatorios")} />
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
