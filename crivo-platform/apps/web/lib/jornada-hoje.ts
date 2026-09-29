// Minha Jornada › Hoje (home do líder) e o Mentor CRIVO.
//
// A tela "Hoje" não tem dado próprio: junta, em cartões independentes, o que o
// líder já tem na plataforma — o ICD do ciclo, sessões do Pocket em andamento,
// decisões ainda sem avaliação e as próximas mentorias dele. A derivação mora
// em lib/ (e não dentro da tela) porque é ela que tem regra — o que conta como
// pendente, o que é "próxima", a data de hoje no fuso de São Paulo, quando a
// tela pode dizer "nada pendente" — e é o que dá para prender em teste sem
// levantar navegador. Mesmo arranjo de `visao-geral-blocos.ts`.

import {
  ICD_AXIS_TRACKS,
  POCKET_MOMENT_LABEL,
  POCKET_QUESTIONS,
  eixoMaisFraco,
  reflexaoPocketRespondida,
  type DecisionData,
  type DecisionImpact,
  type IcdAxis,
  type MeuIcdData,
  type PocketSessionData,
} from "@crivo/types";
import type { MentoriaTenantEntry } from "./api";

/** O "dia" do cliente é o de São Paulo — não o do aparelho nem o do servidor. */
export const FUSO_SP = "America/Sao_Paulo";

/** Rótulo curto dos 4 eixos do ICD oficial (o mesmo da tela Liderança). */
export const EIXO_CURTO: Record<IcdAxis, string> = {
  CLAREZA: "Clareza",
  CRITERIO: "Critério",
  ALINHAMENTO: "Alinhamento",
  SUSTENTACAO: "Sustentação",
};

/** "Terça-feira, 29 de setembro" — hoje no fuso de São Paulo. */
export function dataDeHojeSP(agora: Date = new Date()): string {
  const s = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_SP,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(agora);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Data curta (dd/mm/aaaa) no fuso de São Paulo. */
export function dataCurtaSP(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: FUSO_SP });
}

// ── Foco do ciclo ────────────────────────────────────────────────────────────

export interface FocoDoCiclo {
  eixo: IcdAxis;
  rotulo: string;
  trilha: string;
  /** 1ª prática da trilha do eixo (ICD_AXIS_TRACKS) — o passo de hoje. */
  pratica: string | null;
}

/** Foco = eixo com a MENOR média do líder no ciclo (a mesma regra do "Meu ICD").
 *  null sem ICD ou sem nenhum eixo com valor. */
export function focoDoCiclo(meu: MeuIcdData | null | undefined): FocoDoCiclo | null {
  const eixo = eixoMaisFraco(meu?.icd.axesAverage);
  if (!eixo) return null;
  const t = ICD_AXIS_TRACKS[eixo];
  return { eixo, rotulo: EIXO_CURTO[eixo], trilha: t.title, pratica: t.practices[0] ?? null };
}

/** Sugestões de pergunta ao Mentor pelo eixo em foco (sem ICD: uma genérica). */
export function sugestoesMentor(foco: IcdAxis | null): string[] {
  return foco
    ? [`Como fortalecer o eixo ${EIXO_CURTO[foco]} nas minhas decisões?`,
       "Me dê um exercício prático para a próxima decisão difícil."]
    : ["Como o método CRIVO me ajuda a decidir melhor sob pressão?"];
}

/** Motivo de indisponibilidade do Copiloto que fala com o ADMINISTRADOR
 *  ("configure a IA no Super Admin", token inválido, IA não habilitada) não
 *  serve para o líder: ele não tem o que fazer com isso. Vira um texto neutro;
 *  os demais motivos (limite de uso, falha passageira) seguem como a API mandou. */
export function motivoParaLider(reason: string | null | undefined): string {
  if (!reason?.trim()) return "O Mentor CRIVO não respondeu agora. Tente novamente em instantes.";
  if (/super admin|token de ia|configura|habilitad/i.test(reason)) {
    return "O Mentor CRIVO ainda não está disponível para a sua empresa.";
  }
  return reason;
}

// ── Continue de onde parou ───────────────────────────────────────────────────

/** Impacto em uma palavra — o rótulo oficial traz o peso no ICD entre parênteses. */
const IMPACTO_CURTO: Record<DecisionImpact, string> = { BAIXO: "baixo", MEDIO: "médio", ALTO: "alto" };

export interface Pendencia {
  id: string;
  tipo: "pocket" | "decisao";
  titulo: string;
  detalhe: string;
  acao: "Retomar" | "Avaliar";
  route: "pocket" | "decisoes";
}

/** Sessões do Pocket ainda não concluídas, a mais recente primeiro. */
export function pocketEmAndamento(sessions: readonly PocketSessionData[]): PocketSessionData[] {
  return sessions
    .filter((s) => s.status === "EM_ANDAMENTO")
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

/** Decisões de impacto médio/alto (as que entram no ICD oficial) ainda sem a
 *  avaliação pelos 4 Eixos, a mais recente primeiro. Impacto baixo fica de
 *  fora: não compõe o ICD e não é pendência. */
export function decisoesParaAvaliar(decisions: readonly DecisionData[]): DecisionData[] {
  return decisions
    .filter((d) => d.impact !== "BAIXO" && d.status !== "AVALIADA_PELO_ICD")
    .sort((a, b) => Date.parse(b.decidedAt) - Date.parse(a.decidedAt));
}

/** Lista única do cartão: primeiro o Pocket em andamento, depois as decisões.
 *  Fonte que não carregou (null) simplesmente não entra. */
export function montarPendencias(
  pocket: readonly PocketSessionData[] | null,
  decisoes: readonly DecisionData[] | null,
): Pendencia[] {
  const out: Pendencia[] = [];
  for (const s of pocket ? pocketEmAndamento(pocket) : []) {
    const respondidas = s.reflections.filter(reflexaoPocketRespondida).length;
    out.push({
      id: `pocket:${s.id}`,
      tipo: "pocket",
      titulo: s.context?.trim() || "Reflexão sem contexto",
      detalhe: `Pocket · ${POCKET_MOMENT_LABEL[s.momentOfUse] ?? s.momentOfUse} · ${respondidas}/${POCKET_QUESTIONS.length} afirmações respondidas`,
      acao: "Retomar",
      route: "pocket",
    });
  }
  for (const d of decisoes ? decisoesParaAvaliar(decisoes) : []) {
    out.push({
      id: `decisao:${d.id}`,
      tipo: "decisao",
      titulo: d.title,
      detalhe: `Decisão sem avaliação ICD · impacto ${IMPACTO_CURTO[d.impact] ?? d.impact} · ${dataCurtaSP(d.decidedAt)}`,
      acao: "Avaliar",
      route: "decisoes",
    });
  }
  return out;
}

// ── Próximas mentorias ───────────────────────────────────────────────────────

/** Mentorias AGENDADAS a partir de agora, a mais próxima primeiro (até `limite`).
 *  Mesmo critério de "próxima" da tela de mentorias. */
export function proximasMentorias(
  rows: readonly MentoriaTenantEntry[],
  agora: number = Date.now(),
  limite = 3,
): MentoriaTenantEntry[] {
  return rows
    .filter((m) => m.status === "AGENDADA" && Date.parse(m.scheduledAt) >= agora)
    .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt))
    .slice(0, limite);
}

// ── Atalhos ──────────────────────────────────────────────────────────────────

// A Academia entra nos atalhos: com só ela no contrato (ex.: produto
// Academia), o Hoje mostra o atalho em vez de dizer que nada está liberado.
export const ATALHOS_JORNADA = [
  { route: "pocket", label: "Refletir no Pocket" },
  { route: "decisoes", label: "Registrar decisão" },
  { route: "mentor", label: "Conversar com o Mentor" },
  { route: "jornada-academia", label: "Estudar na Academia" },
] as const;

/** Só os atalhos cujas telas estão no menu do contexto atual. */
export function atalhosVisiveis(pode: (route: string) => boolean) {
  return ATALHOS_JORNADA.filter((a) => pode(a.route));
}

// ── Estado de cada carga e da página ─────────────────────────────────────────

/**
 * fora       = a tela da fonte não está no menu (nem pede — evita 403 no log);
 * carregando = pedida, sem resposta ainda;
 * ok         = respondeu;
 * negado     = 403 (módulo fora do contrato, papel etc.);
 * erro       = rede/500 — NÃO é "sem acesso": a tela não pode concluir nada.
 */
export type StatusCarga = "fora" | "carregando" | "ok" | "negado" | "erro";

/** Classifica a falha de uma carga pelo status HTTP (403 = negado). */
export function statusDaFalha(err: unknown): StatusCarga {
  return (err as { status?: number } | null)?.status === 403 ? "negado" : "erro";
}

/**
 * O que o cartão "Continue de onde parou" mostra. "Nada pendente" é uma
 * AFIRMAÇÃO: só vale quando todas as fontes pedidas responderam. Se uma falhou
 * e a outra veio vazia, o cartão some — melhor calar do que dizer que não há
 * nada sem ter conseguido olhar.
 */
export function estadoContinue(
  pocket: StatusCarga,
  decisoes: StatusCarga,
  qtdItens: number,
): "itens" | "vazio" | "carregando" | "oculto" {
  if (qtdItens > 0) return "itens";
  const pedidas = [pocket, decisoes].filter((s) => s !== "fora");
  if (pedidas.some((s) => s === "carregando")) return "carregando";
  if (pedidas.length > 0 && pedidas.every((s) => s === "ok")) return "vazio";
  return "oculto";
}

/**
 * Estado da página quando nenhum cartão aparece:
 *   - "carregando": ainda há carga pendente;
 *   - "falhou": alguma fonte deu erro de rede/servidor — não dá para afirmar
 *     que o contrato não libera nada;
 *   - "sem-recursos": nada no menu, ou tudo negado (403) — os recursos de
 *     liderança não estão liberados para a empresa.
 * Com algum cartão visível, a página é "ok" (os demais entram quando chegam).
 */
export function estadoDaPagina(
  cargas: readonly StatusCarga[],
  algumCartaoVisivel: boolean,
): "ok" | "carregando" | "falhou" | "sem-recursos" {
  if (algumCartaoVisivel) return "ok";
  if (cargas.some((s) => s === "carregando")) return "carregando";
  if (cargas.some((s) => s === "erro")) return "falhou";
  return "sem-recursos";
}
