import type { Metadata } from "next";
import { Lora, Poppins, Cormorant_Garamond, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "./plataforma/app.css";

const lora = Lora({ variable: "--font-lora", subsets: ["latin"], weight: ["400", "500", "600"], style: ["normal", "italic"] });
const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["200", "300", "400", "500", "600"] });
const cormorant = Cormorant_Garamond({ variable: "--font-cormorant", subsets: ["latin"], weight: ["400", "500"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["500", "700"] });

export const metadata: Metadata = {
  title: "CRIVO™ · Plataforma — Decision Intelligence System",
  description: "A infraestrutura inteligente da liderança moderna.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      // Extensões de navegador injetam atributos no <html> antes do React
      // hidratar — suprime apenas o aviso de mismatch deste elemento.
      suppressHydrationWarning
      className={`${lora.variable} ${poppins.variable} ${cormorant.variable} ${jetbrains.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
