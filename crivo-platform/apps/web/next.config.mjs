import { resolve } from "node:path";

// Raiz do monorepo (necessária para o pnpm resolver pacotes workspace).
const monorepoRoot = resolve(import.meta.dirname, "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@crivo/types", "@crivo/ui"],
  turbopack: { root: monorepoRoot },
  env: {
    // Em produção NÃO embute localhost: se API_URL não estiver setada no build,
    // o cliente falha de forma clara (ver lib/api.ts) em vez de bater na máquina
    // do usuário. Em dev, mantém o fallback local.
    NEXT_PUBLIC_API_URL:
      process.env.API_URL ??
      (process.env.NODE_ENV === "production" ? "" : "http://localhost:3333"),
  },
};

export default nextConfig;
