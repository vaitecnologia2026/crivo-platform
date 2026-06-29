import type { NextConfig } from "next";
import { resolve } from "node:path";

// Raiz do monorepo (crivo-platform) — necessária para o pnpm resolver os pacotes
// workspace (deps ficam em crivo-platform/node_modules/.pnpm).
const monorepoRoot = resolve(import.meta.dirname, "../..");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // @crivo/ui é distribuído como TS-fonte (workspace) — precisa ser transpilado.
  transpilePackages: ["@crivo/ui"],
  // nodemailer é lib Node (SMTP) usada na rota /api/lead — não deve ser empacotada.
  serverExternalPackages: ["nodemailer"],
  turbopack: { root: monorepoRoot },
  // Nos domínios do CLIENTE (crivolegacy.com.br / www / lp), a raiz serve a
  // Landing Page direto (sem o gate VAI), funcionando como o site oficial.
  // A crivo.vai-sistema.com (interno) continua com o gate em "/".
  async rewrites() {
    return [
      {
        source: "/",
        has: [{ type: "host", value: "^(www\\.|lp\\.)?crivolegacy\\.com\\.br$" }],
        destination: "/lp",
      },
    ];
  },
};

export default nextConfig;
