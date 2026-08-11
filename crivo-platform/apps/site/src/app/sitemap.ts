import type { MetadataRoute } from "next";
import { SITE_URL } from "./_site/site.config";

/**
 * §14 — mapa do site para os buscadores.
 *
 * Só entram as páginas públicas de conteúdo. Ficam de fora /design-system
 * (vitrine interna, marcada noindex), o /lp (a Home responde em "/", que é a
 * URL canônica) e as rotas de API.
 */
const ROTAS: { caminho: string; prioridade: number }[] = [
  { caminho: "/", prioridade: 1 },
  { caminho: "/solucoes", prioridade: 0.9 },
  { caminho: "/metodo", prioridade: 0.9 },
  { caminho: "/plataforma", prioridade: 0.9 },
  { caminho: "/conteudos", prioridade: 0.7 },
  { caminho: "/sobre", prioridade: 0.7 },
  { caminho: "/politica-de-privacidade", prioridade: 0.3 },
  { caminho: "/politica-de-cookies", prioridade: 0.3 },
  { caminho: "/termos", prioridade: 0.3 },
  { caminho: "/excluir-conta", prioridade: 0.2 },
  { caminho: "/excluir-dados", prioridade: 0.2 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROTAS.map(({ caminho, prioridade }) => ({
    url: `${SITE_URL}${caminho === "/" ? "" : caminho}`,
    changeFrequency: "monthly",
    priority: prioridade,
  }));
}
