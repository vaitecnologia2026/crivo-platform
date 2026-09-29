import { describe, expect, it } from "vitest";
import type { DecisionData, MeuIcdData, PocketSessionData } from "@crivo/types";
import type { MentoriaTenantEntry } from "./api";
import {
  atalhosVisiveis,
  dataCurtaSP,
  dataDeHojeSP,
  decisoesParaAvaliar,
  estadoContinue,
  estadoDaPagina,
  focoDoCiclo,
  montarPendencias,
  motivoParaLider,
  pocketEmAndamento,
  proximasMentorias,
  statusDaFalha,
  sugestoesMentor,
} from "./jornada-hoje";

// Minha Jornada › Hoje: a tela só junta o que o líder já tem. O que está sob
// teste é a regra — o dia de São Paulo, o que conta como pendente/próxima e
// quando a tela pode AFIRMAR algo ("nada pendente", "não liberado no contrato").

function sessao(over: Partial<PocketSessionData>): PocketSessionData {
  return {
    id: "s1",
    leaderId: "u1",
    context: "Reunião difícil",
    momentOfUse: "ANTES_DECISAO",
    decisionId: null,
    status: "EM_ANDAMENTO",
    questionsVersion: "v2",
    reflections: [],
    aiSummary: null,
    completedAt: null,
    createdAt: "2026-09-20T12:00:00.000Z",
    updatedAt: "2026-09-20T12:00:00.000Z",
    ...over,
  };
}

function decisao(over: Partial<DecisionData>): DecisionData {
  return {
    id: "d1",
    leaderId: "u1",
    title: "Reestruturar a escala",
    description: "Contexto da decisão",
    category: null,
    impact: "MEDIO",
    type: "INDIVIDUAL",
    pocketUse: "NAO_UTILIZADO",
    pressureFactor: "URGENCIA",
    revisionPeriod: "SEM_REVISAO",
    status: "REGISTRADA",
    decidedAt: "2026-09-10T15:00:00.000Z",
    audiences: [],
    sustentationAction: null,
    createdAt: "2026-09-10T15:00:00.000Z",
    updatedAt: "2026-09-10T15:00:00.000Z",
    ...over,
  } as DecisionData;
}

function mentoria(over: Partial<MentoriaTenantEntry>): MentoriaTenantEntry {
  return {
    id: "m1",
    title: "Devolutiva do ciclo",
    format: "ONLINE",
    mentorName: "Ana Mentora",
    attendee: "lider@empresa.com",
    scheduledAt: "2026-10-01T13:00:00.000Z",
    durationMin: 60,
    meetingUrl: null,
    location: null,
    status: "AGENDADA",
    notes: null,
    recordingUrl: null,
    ...over,
  };
}

function meuIcd(axes: Record<string, number>): MeuIcdData {
  return {
    origem: "CICLO_ABERTO",
    cicloNome: "3º tri/2026",
    icd: { axesAverage: axes, score: 70, decisionCount: 2 },
  } as unknown as MeuIcdData;
}

const AGORA = Date.parse("2026-09-29T15:00:00.000Z"); // meio-dia em São Paulo

describe("dataDeHojeSP", () => {
  it("usa o dia de São Paulo, não o de UTC", () => {
    // 02:00Z do dia 29 ainda é 23:00 do dia 28 em São Paulo (UTC-3).
    expect(dataDeHojeSP(new Date("2026-09-29T02:00:00.000Z"))).toBe("Segunda-feira, 28 de setembro");
    expect(dataDeHojeSP(new Date("2026-09-29T15:00:00.000Z"))).toBe("Terça-feira, 29 de setembro");
  });

  it("data curta também no fuso de São Paulo", () => {
    expect(dataCurtaSP("2026-09-10T02:00:00.000Z")).toBe("09/09/2026");
  });
});

describe("focoDoCiclo", () => {
  it("é o eixo de MENOR média, com a 1ª prática da trilha", () => {
    const f = focoDoCiclo(meuIcd({ CLAREZA: 80, CRITERIO: 55, ALINHAMENTO: 70, SUSTENTACAO: 60 }));
    expect(f?.eixo).toBe("CRITERIO");
    expect(f?.rotulo).toBe("Critério");
    expect(f?.trilha).toBe("Manter critério e prioridade sob pressão");
    expect(f?.pratica).toBe("Defina os critérios da decisão antes de avaliar as alternativas.");
  });

  it("sem ICD não há foco (a tela convida a registrar decisões)", () => {
    expect(focoDoCiclo(null)).toBeNull();
    expect(focoDoCiclo(undefined)).toBeNull();
  });

  it("sugestões ao Mentor citam o eixo em foco; sem foco, uma pergunta genérica", () => {
    expect(sugestoesMentor("ALINHAMENTO")[0]).toContain("Alinhamento");
    expect(sugestoesMentor(null)).toHaveLength(1);
  });
});

describe("motivoParaLider", () => {
  it("esconde do líder o recado que é para o administrador", () => {
    expect(motivoParaLider("O Copiloto CRIVO ainda não está ativo. Peça ao administrador para configurar e ativar a IA em Super Admin · Configurações de IA.")).toBe(
      "O Mentor CRIVO ainda não está disponível para a sua empresa.",
    );
    expect(motivoParaLider("Token de IA inválido. Verifique a configuração no Super Admin.")).toContain("não está disponível");
    expect(motivoParaLider("A IA não está habilitada para o Copiloto do líder.")).toContain("não está disponível");
  });

  it("motivo que serve ao líder passa como veio; vazio vira convite a tentar de novo", () => {
    expect(motivoParaLider("Limite de uso da IA excedido. Tente novamente em instantes.")).toBe(
      "Limite de uso da IA excedido. Tente novamente em instantes.",
    );
    expect(motivoParaLider(undefined)).toContain("Tente novamente");
  });
});

describe("Continue de onde parou", () => {
  it("Pocket: só as sessões em andamento, a mais recente primeiro", () => {
    const r = pocketEmAndamento([
      sessao({ id: "a", updatedAt: "2026-09-20T12:00:00.000Z" }),
      sessao({ id: "b", status: "CONCLUIDA" }),
      sessao({ id: "c", updatedAt: "2026-09-25T12:00:00.000Z" }),
    ]);
    expect(r.map((s) => s.id)).toEqual(["c", "a"]);
  });

  it("decisões: impacto médio/alto sem avaliação ICD; impacto baixo não é pendência", () => {
    const r = decisoesParaAvaliar([
      decisao({ id: "baixo", impact: "BAIXO" }),
      decisao({ id: "avaliada", status: "AVALIADA_PELO_ICD" }),
      decisao({ id: "alto", impact: "ALTO", decidedAt: "2026-09-01T15:00:00.000Z" }),
      decisao({ id: "rascunho", status: "EM_REGISTRO", decidedAt: "2026-09-20T15:00:00.000Z" }),
    ]);
    expect(r.map((d) => d.id)).toEqual(["rascunho", "alto"]);
  });

  it("lista única: Pocket (Retomar) antes das decisões (Avaliar); fonte que falhou não entra", () => {
    const itens = montarPendencias(
      [sessao({ reflections: [{ id: "r", questionCode: "C1", value: 4, text: null, tags: [], createdAt: "", updatedAt: "" }] })],
      [decisao({ impact: "ALTO" })],
    );
    expect(itens.map((i) => [i.tipo, i.acao, i.route])).toEqual([
      ["pocket", "Retomar", "pocket"],
      ["decisao", "Avaliar", "decisoes"],
    ]);
    expect(itens[0].detalhe).toContain("1/10 afirmações respondidas");
    expect(itens[1].detalhe).toContain("impacto alto");
    expect(montarPendencias(null, [decisao({})])).toHaveLength(1);
    expect(montarPendencias(null, null)).toEqual([]);
  });

  it('"Nada pendente" só quando TODAS as fontes pedidas responderam', () => {
    expect(estadoContinue("ok", "ok", 0)).toBe("vazio");
    expect(estadoContinue("ok", "fora", 0)).toBe("vazio");
    expect(estadoContinue("ok", "erro", 0)).toBe("oculto");
    expect(estadoContinue("negado", "ok", 0)).toBe("oculto");
    expect(estadoContinue("fora", "fora", 0)).toBe("oculto");
    expect(estadoContinue("carregando", "ok", 0)).toBe("carregando");
    // Com item, mostra o que já chegou mesmo se a outra fonte falhou.
    expect(estadoContinue("ok", "erro", 2)).toBe("itens");
  });
});

describe("proximasMentorias", () => {
  it("só AGENDADAS a partir de agora, a mais próxima primeiro, até 3", () => {
    const r = proximasMentorias(
      [
        mentoria({ id: "passada", scheduledAt: "2026-09-28T13:00:00.000Z" }),
        mentoria({ id: "cancelada", status: "CANCELADA", scheduledAt: "2026-10-02T13:00:00.000Z" }),
        mentoria({ id: "d", scheduledAt: "2026-10-20T13:00:00.000Z" }),
        mentoria({ id: "a", scheduledAt: "2026-09-30T13:00:00.000Z" }),
        mentoria({ id: "c", scheduledAt: "2026-10-10T13:00:00.000Z" }),
        mentoria({ id: "b", scheduledAt: "2026-10-05T13:00:00.000Z" }),
      ],
      AGORA,
    );
    expect(r.map((m) => m.id)).toEqual(["a", "b", "c"]);
  });
});

describe("atalhos e estado da página", () => {
  it("atalho só aparece se a tela está no menu do contexto atual", () => {
    const menu = new Set(["pocket", "mentor", "jornada-academia"]);
    expect(atalhosVisiveis((r) => menu.has(r)).map((a) => a.label)).toEqual([
      "Refletir no Pocket",
      "Conversar com o Mentor",
      "Estudar na Academia",
    ]);
  });

  it("menu só com Hoje e Academia não dá \"sem-recursos\" (a Academia vira atalho)", () => {
    const menu = new Set(["hoje", "jornada-academia"]);
    const atalhos = atalhosVisiveis((r) => menu.has(r));
    expect(atalhos.map((a) => a.route)).toEqual(["jornada-academia"]);
    // Mesmo cálculo da tela: ICD, Pocket, decisões e mentorias ficam "fora".
    expect(estadoDaPagina(["fora", "fora", "fora", "fora"], atalhos.length > 0)).toBe("ok");
  });

  it("403 é negado; rede/500 é erro", () => {
    expect(statusDaFalha({ status: 403 })).toBe("negado");
    expect(statusDaFalha({ status: 500 })).toBe("erro");
    expect(statusDaFalha(new Error("rede"))).toBe("erro");
  });

  it('"não liberado no contrato" só quando nada está no menu ou tudo foi negado', () => {
    expect(estadoDaPagina(["fora", "fora"], false)).toBe("sem-recursos");
    expect(estadoDaPagina(["negado", "negado", "fora"], false)).toBe("sem-recursos");
    // Erro de rede não prova nada sobre o contrato.
    expect(estadoDaPagina(["negado", "erro"], false)).toBe("falhou");
    expect(estadoDaPagina(["carregando", "negado"], false)).toBe("carregando");
    expect(estadoDaPagina(["erro"], true)).toBe("ok");
  });
});
