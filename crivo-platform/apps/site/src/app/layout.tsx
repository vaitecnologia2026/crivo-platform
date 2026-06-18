import type { Metadata } from "next";
import { Lora, Poppins, Cormorant_Garamond, Plus_Jakarta_Sans, JetBrains_Mono, Space_Grotesk } from "next/font/google";
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

// Fonte do portal VAI (gate) — identidade própria, distinta do CRIVO.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

// Mono para dados/números (Design System).
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: "CRIVO™ — Decision Intelligence System",
  description: "A infraestrutura inteligente da liderança moderna.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      // Extensões de navegador (gerenciadores de senha, antivírus, tradutores)
      // injetam atributos no <html> antes do React hidratar — suprime apenas o
      // aviso de mismatch deste elemento, não da árvore.
      suppressHydrationWarning
      className={`${lora.variable} ${poppins.variable} ${cormorant.variable} ${jakarta.variable} ${jetbrains.variable} ${spaceGrotesk.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
