import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CRIVO™ · Plataforma — Decision Intelligence System',
  description: 'A infraestrutura inteligente da liderança moderna.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500&family=Lora:wght@500&family=Poppins:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
