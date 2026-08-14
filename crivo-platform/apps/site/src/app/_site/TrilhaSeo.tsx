import { SITE_URL } from "./site.config";

/**
 * §14 — dados estruturados de NAVEGAÇÃO (BreadcrumbList).
 *
 * O layout já declara Organization e WebSite, e o FAQ da Home declara FAQPage.
 * Faltava a navegação: é o que diz ao Google onde a página fica dentro do site,
 * e é o que ele usa para trocar a URL crua pela trilha no resultado da busca.
 *
 * A hierarquia do site é plana — Início › página —, então a trilha tem dois
 * níveis e é sempre esse par. A Home NÃO usa este componente: uma trilha de um
 * item só (ela mesma) não diz nada, e o Google desconsidera.
 *
 * `item` sai absoluto a partir de SITE_URL porque o schema.org espera URL
 * completa; `caminho` entra como "/solucoes", no mesmo formato que `paginaSeo`
 * já usa para o canonical, para as duas coisas não divergirem.
 */
export function TrilhaSeo({ nome, caminho }: { nome: string; caminho: string }) {
  const trilha = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: nome, item: `${SITE_URL}${caminho}` },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // Conteúdo fixo escrito por nós — nada vem de entrada de usuário.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(trilha) }}
    />
  );
}
