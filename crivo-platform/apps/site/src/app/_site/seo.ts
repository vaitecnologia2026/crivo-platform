import type { Metadata } from "next";

/**
 * §14 — metadados por rota, em um lugar só.
 *
 * Cada página declara título, descrição e o caminho canônico; daqui saem o
 * `<title>`, a description, o `rel="canonical"` e o Open Graph coerente com
 * eles. Sem isto, uma página que não declara `openGraph` herda o do layout e
 * o card de compartilhamento sai com o título da Home.
 *
 * O canonical importa em especial na raiz: a landing responde em "/" (rewrite
 * do proxy) e também em "/lp"; sem canonical, são duas URLs com o mesmo
 * conteúdo.
 */
/**
 * Cartão gerado em app/opengraph-image.tsx. Precisa ser declarado aqui: quando
 * uma rota declara `openGraph`, ela SUBSTITUI o do layout — inclusive a imagem
 * que a convenção de arquivo tinha anexado. Sem esta linha, só as páginas sem
 * `openGraph` próprio sairiam com imagem.
 */
const IMAGEM = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "CRIVO™ — Decidir com clareza. Liderar com coerência. Evoluir com sustentação.",
};

export function paginaSeo({
  titulo,
  descricao,
  caminho,
  indexavel = true,
}: {
  titulo: string;
  descricao: string;
  caminho: string;
  indexavel?: boolean;
}): Metadata {
  return {
    title: titulo,
    description: descricao,
    alternates: { canonical: caminho },
    openGraph: {
      type: "website",
      siteName: "CRIVO™",
      locale: "pt_BR",
      title: titulo,
      description: descricao,
      url: caminho,
      images: [IMAGEM],
    },
    ...(indexavel ? {} : { robots: { index: false, follow: false } }),
  };
}
