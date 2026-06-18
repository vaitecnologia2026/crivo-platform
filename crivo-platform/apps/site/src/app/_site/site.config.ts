// Configuração compartilhada do site de marketing (LP + páginas internas).
// Plataforma React (apps/web). Configurável por env: defina
// NEXT_PUBLIC_PLATAFORMA_URL=https://app.crivolegacy.com.br quando o subdomínio
// estiver no ar. Fallback: preview atual da Vercel.
export const PLATAFORMA_URL =
  process.env.NEXT_PUBLIC_PLATAFORMA_URL ?? "https://crivo-web.vercel.app/";

export const WHATSAPP_ESPECIALISTA =
  "https://wa.me/5511918531796?text=Quero%20falar%20com%20um%20especialista%20CRIVO";
