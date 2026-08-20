import type { Metadata } from "next";
import { CookieConsent } from "./_site/CookieConsent";
import { Analytics } from "./_site/Analytics";
import { SITE_URL } from "./_site/site.config";
import { Lora, Poppins, Cormorant_Garamond, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

// Display moderna (geométrica) — títulos da LP/marketing. Ar "tech/IA/dashboard"
// premium, mantendo as cores e o logo (wordmark segue em Cormorant).
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500"],
});

// Mono para dados/números (Design System).
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["500", "700"],
});

/**
 * §14 — base para Google e mecanismos de busca.
 *
 * `metadataBase` é o que permite que cada rota declare canonical e Open Graph
 * com caminho relativo ("/solucoes") e o Next resolva para a URL absoluta.
 * Sem ele, `alternates.canonical` e `openGraph.url` relativos não viram tag —
 * e o card de compartilhamento sai sem imagem.
 *
 * O `title.template` faz cada página herdar o sufixo da marca sem repetir a
 * string em 13 arquivos.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "CRIVO™ — Decision Intelligence",
  description:
    "Inteligência organizacional aplicada à gestão: diagnóstico, desenvolvimento da liderança, plano de ação e evidências para transformar estratégia em execução.",
  applicationName: "CRIVO™",
  icons: { icon: "/favicon.svg" },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "CRIVO™",
    locale: "pt_BR",
    url: "/",
    title: "CRIVO™ — Decision Intelligence",
    description:
      "Inteligência organizacional aplicada à gestão: diagnóstico, desenvolvimento da liderança, plano de ação e evidências para transformar estratégia em execução.",
  },
  twitter: { card: "summary_large_image" },
};

/**
 * Dados estruturados de empresa e de site (§14: "empresa/Home … navegação").
 * `sameAs` traz só os perfis que existem de fato — YouTube fica fora enquanto
 * não houver canal oficial, como o §10 determina.
 */
const DADOS_ESTRUTURADOS = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organizacao`,
      name: "CRIVO",
      alternateName: "CRIVO™",
      url: SITE_URL,
      description:
        "Consultoria estratégica de inteligência aplicada à gestão, que transforma liderança, cultura e governança em maturidade organizacional, execução consistente e resultados mensuráveis.",
      email: "contato@crivolegacy.com.br",
      parentOrganization: { "@type": "Organization", name: "O2 Legacy & Consulting" },
      sameAs: [
        "https://www.linkedin.com/company/crivolegacy/",
        "https://www.instagram.com/crivolegacy/",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#site`,
      url: SITE_URL,
      name: "CRIVO™",
      inLanguage: "pt-BR",
      publisher: { "@id": `${SITE_URL}/#organizacao` },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      // Extensões de navegador (gerenciadores de senha, antivírus, tradutores)
      // injetam atributos no <html> antes do React hidratar — suprime apenas o
      // aviso de mismatch deste elemento, não da árvore.
      suppressHydrationWarning
      className={`${lora.variable} ${poppins.variable} ${cormorant.variable} ${jetbrains.variable} ${spaceGrotesk.variable}`}
    >
      <body>
        {children}
        {/* §13 — aviso de cookies em todas as rotas. */}
        <Analytics />
        <CookieConsent />
        <script
          type="application/ld+json"
          // Conteúdo fixo escrito por nós — nada vem de entrada de usuário.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(DADOS_ESTRUTURADOS) }}
        />
      </body>
    </html>
  );
}
