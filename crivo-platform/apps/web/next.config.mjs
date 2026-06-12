import { resolve } from "node:path";

// Raiz do monorepo (necessária para o pnpm resolver pacotes workspace).
const monorepoRoot = resolve(import.meta.dirname, "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@crivo/types", "@crivo/ui"],
  turbopack: { root: monorepoRoot },
  env: {
    // URL da API. Usa API_URL do ambiente se definida e NÃO vazia (|| cobre
    // string vazia, que o ?? deixaria passar); senão cai no padrão: a API de
    // produção (Railway) em prod, ou o localhost em dev. Hardcode do default de
    // produção garante a URL embutida mesmo que o build não receba a env
    // (ex.: Turborepo filtra variáveis não declaradas).
    NEXT_PUBLIC_API_URL:
      process.env.API_URL ||
      (process.env.NODE_ENV === "production"
        ? "https://crivo-platform-production.up.railway.app/api"
        : "http://localhost:3333"),
  },
};

export default nextConfig;
