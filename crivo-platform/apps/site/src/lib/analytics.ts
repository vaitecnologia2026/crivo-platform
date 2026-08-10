/**
 * Camada de medição do site (§15 dos Ajustes Finais) — GA4.
 *
 * Duas regras que não podem ser quebradas:
 *
 *  1. NADA roda sem consentimento de "medição" (§13). O gtag só é injetado
 *     depois do aceite; enquanto isso os eventos ficam numa fila e são
 *     descartados se a pessoa recusar. Consentimento que não bloqueia nada é
 *     decoração — aqui ele bloqueia de verdade.
 *
 *  2. Sem NEXT_PUBLIC_GA4_ID configurado, tudo é inerte: nenhum script, nenhum
 *     erro no console. O site funciona igual, só não mede.
 *
 * A atribuição ("de onde veio", "qual campanha gerou o lead") vem dos UTMs
 * capturados na PRIMEIRA visita e guardados na sessão — sem isso o lead que
 * navega antes de converter perde a origem.
 */

export const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID ?? "";

type Params = Record<string, string | number | boolean | undefined>;

const CHAVE_ATRIBUICAO = "crivo.atribuicao.v1";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** Eventos disparados antes do gtag existir (ex.: aceite no meio do fluxo). */
const fila: { nome: string; params: Params }[] = [];

export type Atribuicao = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  referrer?: string;
  landing?: string;
};

/**
 * Origem da PRIMEIRA visita desta sessão. Guardar é essencial: quem chega por
 * um anúncio, navega três páginas e só então preenche o MAPA chegaria ao CRM
 * sem campanha nenhuma se lêssemos a URL só na hora do envio.
 */
export function capturarAtribuicao(): Atribuicao {
  if (typeof window === "undefined") return {};
  try {
    const salvo = window.sessionStorage.getItem(CHAVE_ATRIBUICAO);
    if (salvo) return JSON.parse(salvo) as Atribuicao;

    const q = new URLSearchParams(window.location.search);
    const dados: Atribuicao = {};
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const) {
      const v = q.get(k);
      if (v) dados[k] = v.slice(0, 120);
    }
    // Referrer externo: complementa quando não há UTM (busca orgânica, indicação).
    if (document.referrer && !document.referrer.includes(window.location.host)) {
      dados.referrer = document.referrer.slice(0, 200);
    }
    dados.landing = window.location.pathname.slice(0, 120);
    window.sessionStorage.setItem(CHAVE_ATRIBUICAO, JSON.stringify(dados));
    return dados;
  } catch {
    return {};
  }
}

/** Consentimento de medição já dado? (mesma chave usada pelo banner do §13.) */
function podeMedir(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const cru = window.localStorage.getItem("crivo.cookies.v1");
    return cru ? JSON.parse(cru).medicao === true : false;
  } catch {
    return false;
  }
}

/**
 * Chamado pelo onLoad do <Script> do Next quando o gtag terminou de carregar:
 * esvazia o que a pessoa fez entre o aceite e o script ficar pronto.
 */
export function marcarGtagPronto() {
  if (typeof window === "undefined" || !window.gtag) return;
  while (fila.length) {
    const e = fila.shift()!;
    window.gtag("event", e.nome, e.params);
  }
}

/**
 * Registra um evento. Seguro de chamar em qualquer lugar: sem consentimento ou
 * sem GA4_ID, simplesmente não faz nada.
 */
export function evento(nome: string, params: Params = {}) {
  if (typeof window === "undefined" || !GA4_ID) return;
  if (!podeMedir()) return;
  if (!window.gtag) {
    fila.push({ nome, params });
    return;
  }
  window.gtag("event", nome, params);
}

/** Nomes usados no site — um lugar só, para o relatório do GA4 não virar sopa. */
export const EVENTOS = {
  mapaIniciado: "mapa_iniciado",
  mapaConcluido: "mapa_concluido",
  cliqueWhatsapp: "clique_whatsapp",
  acessoPortal: "acesso_portal",
} as const;
