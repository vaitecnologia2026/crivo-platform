import { Capacitor } from "@capacitor/core";

// Origem pública oficial da plataforma. Usada para montar links compartilhados
// com terceiros (campanhas, questionários). No app nativo iOS/Android,
// `window.location.origin` é `capacitor://localhost` — inútil fora do app —
// então usamos o domínio público real.
const PUBLIC_ORIGIN = "https://app.crivolegacy.com.br";

export function publicOrigin(): string {
  if (Capacitor.isNativePlatform()) return PUBLIC_ORIGIN;
  if (typeof window !== "undefined") return window.location.origin;
  return PUBLIC_ORIGIN;
}
