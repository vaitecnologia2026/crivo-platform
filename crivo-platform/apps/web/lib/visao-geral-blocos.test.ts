import { describe, expect, it } from "vitest";
import {
  montarAcoesPrioritarias,
  montarAlertas,
  montarDistribuicao,
  montarFatores,
} from "./visao-geral-blocos";
import type { DashboardDiagnostic, PsychosocialResults } from "./api";
import type { ActionItemData, ActionPlanData } from "@crivo/types";

// Blocos do Panorama/Execução portados do protótipo (lovable/Portal do Cliente,
// 23/09). No protótipo esses cards são constantes de demonstração; aqui derivam
// da API — e é a derivação que está sob teste: ordem de prioridade, a escala de
// cada motor e o que conta (ou não) como alerta.

/** "Hoje" congelado: sem isso o teste de dias de atraso quebraria amanhã.
 *  15:00Z = meio-dia em São Paulo — o MESMO formato que o portal grava em
 *  `dueDate` (PlanoAcaoScreen: `new Date(\`${data}T12:00:00\`).toISOString()`).
 *  Prazo gravado à meia-noite UTC cairia no dia anterior em UTC-3 e a contagem
 *  de atraso sairia um dia a mais. */
const HOJE = new Date("2026-09-23T15:00:00.000Z").getTime();

function linhaMatriz(over: Record<string, unknown>) {
  return {
    slug: "fator-a",
    label: "Sobrecarga de trabalho",
    criticalCount: 4,
    respondents: 10,
    percentCritical: 40,
    exposureAvg: 4.2,
    highExposureCount: 7,
    exposureCount: 10,
    probability: 4,
    severity: 4,
    risk: 16,
    riskClass: "MUITO_ALTO",
    actionLabel: "Prioridade imediata",
    planRequired: true,
    ...over,
  };
}

function psicossocial(matriz: unknown[]): PsychosocialResults {
  return {
    minRespondents: 5,
    totalRespondents: 10,
    overall: {
      suppressed: false,
      score: 58,
      level: "MODERADO",
      byDimension: {},
      topRisk: "dim-1",
      riskMatrix: matriz,
    },
    sectors: [],
  } as unknown as PsychosocialResults;
}

const DIAG_PSI: DashboardDiagnostic = {
  engine: "PSYCHOSOCIAL",
  instrumentSlug: "diagnostico-organizacional",
  instrumentName: "Diagnóstico Organizacional (NR-1)",
  aggregate: null,
};

const DIAG_ESSENCIAL: DashboardDiagnostic = {
  engine: "DIAGNOSTICS",
  instrumentSlug: "diagnostico-essencial",
  instrumentName: "Diagnóstico Essencial",
  aggregate: {
    minRespondents: 5,
    totalRespondents: 7,
    suppressed: false,
    score: 62,
    byDimension: { "dim-1": 80, "dim-2": 45, "dim-3": 61 },
    dimensionLabels: { "dim-1": "Clareza", "dim-2": "Demandas", "dim-3": "Autonomia" },
    dimensionBands: {
      "dim-1": { code: "BOM", label: "Consolidado", color: "#2e7d32" },
      "dim-2": { code: "RUIM", label: "Frágil", color: "#c62828" },
      "dim-3": { code: "MEDIO", label: "Em estruturação", color: "#f9a825" },
    },
  },
};

function item(over: Partial<ActionItemData>): ActionItemData {
  return {
    id: "i1",
    planId: "p1",
    point: "Sobrecarga de trabalho",
    origin: null,
    action: "Redistribuir demandas por fila única",
    responsible: "RH",
    dueDate: "2026-10-30T15:00:00.000Z",
    status: "APROVADA",
    expectedEvidence: "Ata da redistribuição",
    reviewDate: null,
    exposedGroup: null,
    severity: null,
    probability: null,
    riskLevel: null,
    areaProcess: null,
    existingMeasure: null,
    indicator: null,
    objective: null,
    sourceInstrumentSlug: null,
    sourceInstrumentName: null,
    evidences: [],
    ...over,
  } as unknown as ActionItemData;
}

function plano(items: ActionItemData[]): ActionPlanData[] {
  return [{ id: "p1", title: "Plano 2026", validatedAt: null, items } as unknown as ActionPlanData];
}

describe("Fatores prioritários (Panorama)", () => {
  it("no motor psicossocial ordena pelo RISCO da matriz, do maior para o menor", () => {
    const psy = psicossocial([
      linhaMatriz({ slug: "fator-a", risk: 9, riskClass: "MODERADO", probability: 3, severity: 3 }),
      linhaMatriz({ slug: "fator-b", label: "Prazos", risk: 20, riskClass: "MUITO_ALTO", probability: 5, severity: 4 }),
      linhaMatriz({ slug: "fator-c", label: "Suporte", risk: 15, riskClass: "ALTO", probability: 5, severity: 3 }),
    ]);
    const bloco = montarFatores(psy, DIAG_PSI);
    expect(bloco).not.toBeNull();
    expect(bloco!.linhas.map((l) => l.chave)).toEqual(["fator-b", "fator-c", "fator-a"]);
    expect(bloco!.linhas[0].max).toBe(25); // escala da matriz, não 0–100
    // A classificação chega escrita, não como código do enum.
    expect(bloco!.linhas[0].nota).toContain("Muito alto / Prioridade imediata");
    expect(bloco!.linhas[0].nota).not.toContain("MUITO_ALTO");
  });

  it("no motor de diagnósticos ordena pelo MENOR índice (é por onde se começa)", () => {
    const bloco = montarFatores(null, DIAG_ESSENCIAL);
    expect(bloco).not.toBeNull();
    expect(bloco!.linhas.map((l) => l.rotulo)).toEqual(["Demandas", "Autonomia", "Clareza"]);
    expect(bloco!.linhas[0].max).toBe(100);
    expect(bloco!.linhas[0].cor).toBe("#c62828"); // cor da faixa que a API mandou
  });

  it("empresa do Essencial não cai no caminho psicossocial (senão a tela mostra 'dim-1')", () => {
    // /psychosocial/results responde também para o motor de diagnósticos, mas
    // com os códigos crus da metodologia — por isso o desvio por `engine`.
    const psy = psicossocial([linhaMatriz({})]);
    const bloco = montarFatores(psy, DIAG_ESSENCIAL);
    expect(bloco!.titulo).toBe("Dimensões prioritárias");
    expect(bloco!.linhas[0].rotulo).toBe("Demandas");
  });

  it("sem resultado liberado devolve null (o card mostra o estado vazio)", () => {
    expect(montarFatores(null, null)).toBeNull();
  });

  it("corta em 8 fatores: o card é um resumo, não a matriz inteira", () => {
    const psy = psicossocial(
      Array.from({ length: 12 }, (_, i) => linhaMatriz({ slug: `f${i}`, risk: 25 - i })),
    );
    expect(montarFatores(psy, DIAG_PSI)!.linhas).toHaveLength(8);
  });
});

describe("Distribuição de risco (donut)", () => {
  it("conta FATORES por classe, do mais grave para o menos grave", () => {
    const psy = psicossocial([
      linhaMatriz({ slug: "a", riskClass: "ALTO" }),
      linhaMatriz({ slug: "b", riskClass: "BAIXO" }),
      linhaMatriz({ slug: "c", riskClass: "ALTO" }),
      linhaMatriz({ slug: "d", riskClass: "CRITICO" }),
    ]);
    const bloco = montarDistribuicao(psy, DIAG_PSI);
    expect(bloco!.total).toBe(4);
    expect(bloco!.legenda).toBe("fatores");
    expect(bloco!.fatias.map((f) => [f.rotulo, f.valor])).toEqual([
      ["Crítico / Intolerável", 1],
      ["Alto / Requer plano de ação", 2],
      ["Baixo / Tolerável", 1],
    ]);
    // A soma das fatias TEM de ser o total: é ela que fecha o círculo do donut.
    expect(bloco!.fatias.reduce((n, f) => n + f.valor, 0)).toBe(bloco!.total);
  });

  it("no motor de diagnósticos conta DIMENSÕES por faixa da metodologia", () => {
    const bloco = montarDistribuicao(null, DIAG_ESSENCIAL);
    expect(bloco!.total).toBe(3);
    expect(bloco!.legenda).toBe("dimensões");
    expect(bloco!.fatias.reduce((n, f) => n + f.valor, 0)).toBe(3);
  });
});

describe("Alertas prioritários", () => {
  it("ação aprovada vencida entra com os dias de atraso, a mais atrasada primeiro", () => {
    const alertas = montarAlertas(
      plano([
        item({ id: "a", dueDate: "2026-09-20T15:00:00.000Z" }),
        item({ id: "b", dueDate: "2026-09-13T15:00:00.000Z" }),
      ]),
      HOJE,
    );
    expect(alertas.map((a) => [a.id, a.atraso])).toEqual([["b", 10], ["a", 3]]);
  });

  it("ação aprovada sem responsável ou evidência é alerta — é o gate 3 do Dossiê", () => {
    const alertas = montarAlertas(plano([item({ id: "c", responsible: null, expectedEvidence: null })]), HOJE);
    expect(alertas).toHaveLength(1);
    expect(alertas[0].atraso).toBeNull();
    expect(alertas[0].detalhe).toContain("responsável");
    expect(alertas[0].detalhe).toContain("evidência esperada");
  });

  it("ação no prazo e completa não vira alerta; sugestão pendente também não", () => {
    const alertas = montarAlertas(
      plano([
        item({ id: "ok" }),
        item({ id: "sug", status: "SUGERIDA", responsible: null, dueDate: null, expectedEvidence: null }),
      ]),
      HOJE,
    );
    expect(alertas).toEqual([]);
  });

  it("vencida não é contada duas vezes quando também está incompleta", () => {
    const alertas = montarAlertas(
      plano([item({ id: "d", dueDate: "2026-09-01T15:00:00.000Z", responsible: null, expectedEvidence: null })]),
      HOJE,
    );
    expect(alertas).toHaveLength(1);
    expect(alertas[0].atraso).toBe(22);
  });

  it("nunca passa de 6 itens — o card é um alerta, não um relatório", () => {
    const itens = Array.from({ length: 9 }, (_, i) =>
      item({ id: `v${i}`, dueDate: "2026-09-10T15:00:00.000Z" }),
    );
    expect(montarAlertas(plano(itens), HOJE)).toHaveLength(6);
  });
});

describe("Ações prioritárias (Execução)", () => {
  it("são as 5 aprovadas com o prazo mais próximo; sem prazo vai para o fim", () => {
    const acoes = montarAcoesPrioritarias(
      plano([
        item({ id: "1", dueDate: null }),
        item({ id: "2", dueDate: "2026-12-01T15:00:00.000Z" }),
        item({ id: "3", dueDate: "2026-10-01T15:00:00.000Z" }),
        item({ id: "4", status: "CONCLUIDA", dueDate: "2026-09-01T15:00:00.000Z" }),
        item({ id: "5", status: "EM_ANDAMENTO", dueDate: "2026-11-01T15:00:00.000Z" }),
        item({ id: "6", dueDate: "2026-10-15T15:00:00.000Z" }),
        item({ id: "7", dueDate: "2026-10-20T15:00:00.000Z" }),
      ]),
    );
    // "4" está concluída e sai. Das 6 abertas restantes entram as 5 primeiras,
    // e a sem prazo ("1") é justamente a que fica de fora.
    expect(acoes.map((a) => a.id)).toEqual(["3", "6", "7", "5", "2"]);
  });

  it("plano ainda carregando devolve lista vazia em vez de quebrar", () => {
    expect(montarAcoesPrioritarias(null)).toEqual([]);
    expect(montarAlertas(null, HOJE)).toEqual([]);
  });
});

describe("Convenção de prazo (meio-dia local)", () => {
  it("prazo de hoje ainda não está vencido — atraso só a partir do dia seguinte", () => {
    // O portal grava o prazo ao meio-dia local justamente para o dia do
    // calendário não escorregar em UTC-3. Vencer no próprio dia seria cobrar
    // a ação antes de o prazo acabar.
    const hojeMesmo = montarAlertas(plano([item({ id: "hoje", dueDate: "2026-09-23T15:00:00.000Z" })]), HOJE);
    expect(hojeMesmo).toEqual([]);
    const amanha = montarAlertas(plano([item({ id: "ontem", dueDate: "2026-09-22T15:00:00.000Z" })]), HOJE);
    expect(amanha[0].atraso).toBe(1);
  });
});
