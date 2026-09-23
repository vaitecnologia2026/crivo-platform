// Blocos da Visão Geral portados do protótipo (lovable/Portal do Cliente/src/
// routes/dashboard.tsx): fatores prioritários, distribuição de risco, alertas e
// ações prioritárias.
//
// Lá esses cards são alimentados por constantes de demonstração; aqui derivam do
// que a API devolve. A derivação mora em lib/ — e não dentro da tela — porque é
// ela que tem regra de negócio (ordem de prioridade, escala de cada motor, o que
// conta como alerta) e é o que dá para prender em teste sem levantar navegador.
// Mesmo arranjo de `workforce-aggregates.ts`.

import {
  ICD_AXES,
  ICD_AXIS_LABEL,
  PSYCHOSOCIAL_RISK_CLASS_LABEL,
  type ActionItemData,
  type ActionPlanData,
  type ActionStatus,
  type CampaignSummary,
  type IcdCycleHistoryEntry,
} from "@crivo/types";
import type { DashboardDiagnostic, PsychosocialResults } from "./api";

/** Cor por classe de risco da matriz 5×5. A API manda a classe, não a cor
 *  (cor só vem em `dimensionBands`, que é outra coisa) — o mapa é daqui. */
export const COR_CLASSE_RISCO: Record<string, string> = {
  BAIXO: "var(--success)",
  MODERADO: "var(--gold)",
  ALTO: "var(--gold-deep)",
  MUITO_ALTO: "var(--danger)",
  CRITICO: "var(--danger)",
};

export type LinhaFator = { chave: string; rotulo: string; valor: number; max: number; cor: string; nota: string };
export type BlocoFatores = { titulo: string; descricao: string; fonte: string; linhas: LinhaFator[] };

/**
 * "NR-1 · fatores prioritários" do protótipo, servindo aos DOIS motores:
 * no psicossocial a barra é o risco da matriz (P × S, 1–25, maior = pior);
 * no motor de diagnósticos é o índice da dimensão (0–100, menor = pior).
 *
 * O desdobramento não é preciosismo: `/psychosocial/results` responde também
 * para o motor de diagnósticos, mas com os códigos crus da metodologia — ler
 * dali para uma empresa do Essencial colocaria "dim-1" na tela. Por isso o
 * caminho psicossocial só vale quando o motor NÃO é o de diagnósticos.
 */
export function montarFatores(
  psy: PsychosocialResults | null,
  diag: DashboardDiagnostic | null,
): BlocoFatores | null {
  const geral = psy && !psy.overall.suppressed ? psy.overall : null;
  const matriz = geral?.riskMatrix;
  if (diag?.engine !== "DIAGNOSTICS" && matriz && matriz.length > 0) {
    const linhas = [...matriz]
      .sort((a, b) => b.risk - a.risk)
      .slice(0, 8)
      .map((r) => ({
        chave: r.slug,
        rotulo: r.label,
        valor: r.risk,
        max: 25,
        cor: COR_CLASSE_RISCO[r.riskClass] ?? "var(--gold)",
        nota: `${PSYCHOSOCIAL_RISK_CLASS_LABEL[r.riskClass] ?? r.riskClass} · P${r.probability} × S${r.severity}`,
      }));
    return {
      titulo: "Fatores prioritários",
      descricao: "Risco por fator no ciclo atual, do maior para o menor.",
      fonte: `Matriz de risco 5×5 · ${psy!.totalRespondents} respondente(s) · risco = probabilidade × severidade (1–25)`,
      linhas,
    };
  }
  const agg = diag?.engine === "DIAGNOSTICS" && diag.aggregate && !diag.aggregate.suppressed ? diag.aggregate : null;
  const dims = agg?.byDimension;
  if (!agg || !dims || Object.keys(dims).length === 0) return null;
  const linhas = Object.entries(dims)
    // Menor índice primeiro: é por onde a empresa começa (mesma ordem do card
    // "Resultado do diagnóstico", para as duas leituras não se contradizerem).
    .sort((a, b) => a[1] - b[1])
    .slice(0, 8)
    .map(([slug, valor]) => ({
      chave: slug,
      rotulo: agg.dimensionLabels?.[slug] ?? slug,
      valor,
      max: 100,
      cor: agg.dimensionBands?.[slug]?.color ?? "var(--gold)",
      nota: agg.dimensionBands?.[slug]?.label ?? "",
    }));
  return {
    titulo: "Dimensões prioritárias",
    descricao: "Índice por dimensão no ciclo atual, do menor para o maior.",
    fonte: `${diag?.instrumentName ?? "Diagnóstico contratado"} · ${agg.totalRespondents} respondente(s) · escala 0–100`,
    linhas,
  };
}

export type Fatia = { rotulo: string; valor: number; cor: string };
export type BlocoDistribuicao = { fatias: Fatia[]; total: number; legenda: string; fonte: string };

/** Donut "Distribuição de risco" do protótipo: quantos FATORES (psicossocial) ou
 *  quantas DIMENSÕES (motor de diagnósticos) caem em cada faixa. */
export function montarDistribuicao(
  psy: PsychosocialResults | null,
  diag: DashboardDiagnostic | null,
): BlocoDistribuicao | null {
  const geral = psy && !psy.overall.suppressed ? psy.overall : null;
  const matriz = geral?.riskMatrix;
  if (diag?.engine !== "DIAGNOSTICS" && matriz && matriz.length > 0) {
    // Ordem fixa do mais grave para o menos grave: a leitura do donut é sempre
    // a mesma, independentemente da ordem em que os fatores chegaram.
    const ordem = ["CRITICO", "MUITO_ALTO", "ALTO", "MODERADO", "BAIXO"];
    const contagem = new Map<string, number>();
    for (const r of matriz) contagem.set(r.riskClass, (contagem.get(r.riskClass) ?? 0) + 1);
    const fatias = ordem
      .filter((c) => (contagem.get(c) ?? 0) > 0)
      .map((c) => ({
        rotulo: PSYCHOSOCIAL_RISK_CLASS_LABEL[c as keyof typeof PSYCHOSOCIAL_RISK_CLASS_LABEL] ?? c,
        valor: contagem.get(c) ?? 0,
        cor: COR_CLASSE_RISCO[c] ?? "var(--line)",
      }));
    return {
      fatias,
      total: matriz.length,
      legenda: "fatores",
      fonte: `Matriz de risco 5×5 · ${matriz.length} fator(es) classificado(s) · ${psy!.totalRespondents} respondente(s)`,
    };
  }
  const agg = diag?.engine === "DIAGNOSTICS" && diag.aggregate && !diag.aggregate.suppressed ? diag.aggregate : null;
  const bandas = agg?.dimensionBands;
  const dims = agg?.byDimension;
  if (!agg || !bandas || !dims) return null;
  const contagem = new Map<string, { n: number; cor: string }>();
  for (const slug of Object.keys(dims)) {
    const b = bandas[slug];
    if (!b) continue;
    const atual = contagem.get(b.label) ?? { n: 0, cor: b.color ?? "var(--gold)" };
    contagem.set(b.label, { n: atual.n + 1, cor: atual.cor });
  }
  if (contagem.size === 0) return null;
  const fatias = [...contagem.entries()].map(([rotulo, v]) => ({ rotulo, valor: v.n, cor: v.cor }));
  return {
    fatias,
    total: Object.keys(dims).length,
    legenda: "dimensões",
    fonte: `${diag?.instrumentName ?? "Diagnóstico contratado"} · faixas da metodologia ativa · ${agg.totalRespondents} respondente(s)`,
  };
}

export type Alerta = { id: string; titulo: string; detalhe: string; atraso: number | null };

const DIA_MS = 86_400_000;

/**
 * "Alertas prioritários" do protótipo. Lá é uma lista fixa; aqui são as duas
 * coisas que travam a emissão do Dossiê de verdade: ação aprovada VENCIDA e
 * ação aprovada sem responsável, prazo ou evidência esperada (gate 3 de
 * `bloqueiosDoPlano`, no lado da API). O alerta aponta exatamente o que o
 * cliente precisa resolver para o documento sair.
 *
 * `agora` entra por parâmetro: ler o relógio aqui dentro tornaria a função
 * impura — e impossível de testar sem congelar o tempo.
 */
export function montarAlertas(plans: ActionPlanData[] | null, agora: number): Alerta[] {
  if (!plans) return [];
  const hoje = new Date(agora);
  hoje.setHours(0, 0, 0, 0);
  const vencidas: Alerta[] = [];
  const incompletas: Alerta[] = [];
  for (const p of plans) {
    for (const it of p.items) {
      // Sugestão pendente de decisão não é alerta: o cliente ainda vai aprovar
      // ou descartar, e cobrar prazo dela seria cobrar o que não foi decidido.
      if (it.status !== "APROVADA" && it.status !== "EM_ANDAMENTO") continue;
      const titulo = it.action || it.point;
      if (it.dueDate) {
        const prazo = new Date(it.dueDate);
        prazo.setHours(0, 0, 0, 0);
        const dias = Math.floor((hoje.getTime() - prazo.getTime()) / DIA_MS);
        if (dias > 0) {
          vencidas.push({
            id: it.id,
            titulo,
            detalhe: `${it.point} · Resp.: ${it.responsible ?? "não definido"} · prazo ${prazo.toLocaleDateString("pt-BR")}`,
            atraso: dias,
          });
          // Vencida já entrou: não repete como "incompleta" logo abaixo.
          continue;
        }
      }
      const faltando = [
        !it.responsible ? "responsável" : null,
        !it.dueDate ? "prazo" : null,
        !it.expectedEvidence ? "evidência esperada" : null,
      ].filter(Boolean);
      if (faltando.length > 0) {
        incompletas.push({
          id: it.id,
          titulo,
          detalhe: `${it.point} · falta ${faltando.join(", ")} — sem isso o Dossiê não é emitido`,
          atraso: null,
        });
      }
    }
  }
  vencidas.sort((a, b) => (b.atraso ?? 0) - (a.atraso ?? 0));
  return [...vencidas, ...incompletas].slice(0, 6);
}

export type AcaoPrioritaria = { id: string; titulo: string; detalhe: string; status: ActionStatus };

/** "Ações prioritárias · Top 5 do Plano de Evolução" do protótipo. A ordem é a
 *  do prazo (mais próximo primeiro, sem prazo por último) — não a de cadastro. */
export function montarAcoesPrioritarias(plans: ActionPlanData[] | null): AcaoPrioritaria[] {
  if (!plans) return [];
  const abertas: ActionItemData[] = plans
    .flatMap((p) => p.items)
    .filter((it) => it.status === "APROVADA" || it.status === "EM_ANDAMENTO");
  const chave = (it: ActionItemData) => (it.dueDate ? new Date(it.dueDate).getTime() : Number.MAX_SAFE_INTEGER);
  return [...abertas]
    .sort((a, b) => chave(a) - chave(b))
    .slice(0, 5)
    .map((it) => ({
      id: it.id,
      titulo: it.action || it.point,
      detalhe: `${it.responsible ?? "sem responsável"} · ${it.dueDate ? `prazo ${new Date(it.dueDate).toLocaleDateString("pt-BR")}` : "sem prazo"}`,
      status: it.status,
    }));
}

// ═══════════════════════════════════════════════════════════════════════════
// Blocos da 2ª rodada (23/09): o cliente comparou com o protótipo e apontou o
// que faltava. Estes três TÊM fonte real e eu não os tinha construído.
// ═══════════════════════════════════════════════════════════════════════════

export type SegmentoFaixa = { rotulo: string; percent: number; cor: string };
export type LinhaDistribuicao = { chave: string; rotulo: string; segmentos: SegmentoFaixa[] };
export type BlocoPorFator = { linhas: LinhaDistribuicao[]; faixas: { rotulo: string; cor: string }[]; fonte: string };

/**
 * Cor da faixa pela POSIÇÃO. A API devolve as faixas em ordem crescente de
 * pontuação e a PRIMEIRA é a crítica (menor pontuação = maior risco). O `byBand`
 * traz código e rótulo, mas não cor — então a escala é daqui: pior em vermelho,
 * melhor em azul, como no protótipo.
 */
export function corDaFaixa(indice: number, total: number): string {
  if (total <= 1) return "var(--gold)";
  if (indice === 0) return "var(--danger)";
  if (indice === total - 1) return "var(--azul-cobalto)";
  return indice < total / 2 ? "var(--gold-deep)" : "var(--gold)";
}

/**
 * "Distribuição por fator" do protótipo: das pessoas que responderam, quantas
 * (%) caíram em cada faixa, dimensão a dimensão. Vem de `overall.profile`, o
 * mesmo dado que a tela do Psicossocial já mostra como tabela ("Perfil de
 * grupo") — a média sozinha esconde concentração na faixa crítica.
 */
export function montarDistribuicaoPorFator(psy: PsychosocialResults | null): BlocoPorFator | null {
  const geral = psy && !psy.overall.suppressed ? psy.overall : null;
  const perfil = geral?.profile;
  if (!perfil || perfil.length === 0 || !perfil[0].byBand?.length) return null;
  const faixas = perfil[0].byBand.map((b, i) => ({
    rotulo: b.label,
    cor: corDaFaixa(i, perfil[0].byBand.length),
  }));
  const linhas = perfil.slice(0, 8).map((r) => ({
    chave: r.slug,
    rotulo: r.label,
    segmentos: r.byBand.map((b, i) => ({
      rotulo: b.label,
      percent: b.percent,
      cor: corDaFaixa(i, r.byBand.length),
    })),
  }));
  return {
    linhas,
    faixas,
    fonte: `Perfil de grupo · ${psy!.totalRespondents} respondente(s) · % de pessoas em cada faixa da metodologia ativa`,
  };
}

export type BlocoEvolucao = { rotulos: string[]; valores: (number | null)[]; fonte: string };

/**
 * "Evolução por ciclo" — cobertura (adesão) de cada campanha ENCERRADA, na
 * ordem em que fecharam. É a única série temporal que existe hoje do lado do
 * diagnóstico: a plataforma não guarda retrato do índice por ciclo, então
 * "risco agregado por ciclo" do protótipo continua sem fonte.
 */
export function montarEvolucaoCobertura(campanhas: CampaignSummary[] | null): BlocoEvolucao | null {
  if (!campanhas) return null;
  const fechadas = campanhas
    .filter((c) => c.closedAt)
    .sort((a, b) => new Date(a.closedAt!).getTime() - new Date(b.closedAt!).getTime());
  if (fechadas.length === 0) return null;
  return {
    rotulos: fechadas.map((c) => new Date(c.closedAt!).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })),
    valores: fechadas.map((c) => c.adesao),
    fonte: `Campanhas encerradas · adesão = respondidos ÷ convidados · ${fechadas.length} ciclo(s)`,
  };
}

/** "Evolução do índice" com o que EXISTE: o ICD da empresa por ciclo fechado. */
export function montarEvolucaoIcd(historico: IcdCycleHistoryEntry[] | null): BlocoEvolucao | null {
  if (!historico) return null;
  const comResultado = historico
    .filter((h) => h.company && !h.company.suppressed && h.company.score != null)
    .sort((a, b) => a.cycle.year - b.cycle.year || a.cycle.quarter - b.cycle.quarter);
  if (comResultado.length === 0) return null;
  return {
    rotulos: comResultado.map((h) => `${h.cycle.quarter}T/${String(h.cycle.year).slice(2)}`),
    valores: comResultado.map((h) => h.company!.score),
    fonte: `Ciclos trimestrais de ICD fechados · escala 0–100 · supressão §11 aplicada`,
  };
}

export type EixoIcd = { rotulo: string; valor: number };

/** Os 4 Eixos do ICD como radar — o formato do protótipo. */
export function montarRadarIcd(axesAverage: Record<string, number> | null | undefined): EixoIcd[] | null {
  if (!axesAverage) return null;
  const eixos = ICD_AXES.map((ax) => ({
    rotulo: ICD_AXIS_LABEL[ax].replace(" Decisória", "").replace(" Decisório", ""),
    valor: Math.round(axesAverage[ax] ?? 0),
  }));
  return eixos.some((e) => e.valor > 0) ? eixos : null;
}

/**
 * KPI "Cobertura" do protótipo: adesão do ciclo mais recente (encerrado ou, na
 * falta, o aberto). Não é a mesma coisa que "Participação" — participação é
 * quantos responderam, cobertura é quantos dos CONVIDADOS responderam.
 */
export function montarCobertura(campanhas: CampaignSummary[] | null): { percent: number; convidados: number; respondidos: number } | null {
  if (!campanhas || campanhas.length === 0) return null;
  const ordenadas = [...campanhas].sort(
    (a, b) => new Date(b.closedAt ?? b.createdAt).getTime() - new Date(a.closedAt ?? a.createdAt).getTime(),
  );
  const alvo = ordenadas.find((c) => c.convidados > 0);
  if (!alvo) return null;
  return { percent: alvo.adesao, convidados: alvo.convidados, respondidos: alvo.respondidos };
}
