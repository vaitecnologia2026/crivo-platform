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
};

export default nextConfig;
