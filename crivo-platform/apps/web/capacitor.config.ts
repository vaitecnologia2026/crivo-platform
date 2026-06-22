import type { CapacitorConfig } from "@capacitor/cli";

// Wrapper Android (Capacitor 8) do CRIVO. O conteúdo é o export estático do
// Next.js (`out/`), gerado com CAP_EXPORT=1. O app roda contra a API de
// produção (Railway) embutida no bundle — não há servidor local.
const config: CapacitorConfig = {
  appId: "com.vaisistema.crivo",
  appName: "CRIVO",
  webDir: "out",
  android: {
    allowMixedContent: false,
  },
};

export default config;
