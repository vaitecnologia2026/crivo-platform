import { resolve } from "node:path";

// Raiz do monorepo (necessária para o pnpm resolver pacotes workspace).
const monorepoRoot = resolve(import.meta.dirname, "../..");

// Build de empacotamento Capacitor (Android). Ativado por env CAP_EXPORT=1.
// NÃO afeta o build web normal da Vercel/Railway (sem a env, tudo igual a antes).
const isCapExport = process.env.CAP_EXPORT === "1";

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
    // (ex.: Turborepo filtra variáveis não declaradas). No empacotamento
    // Capacitor força a API de produção, pois o app roda offline-of-server.
    NEXT_PUBLIC_API_URL:
      process.env.API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      (isCapExport || process.env.NODE_ENV === "production"
        ? "https://crivo-platform-production.up.railway.app/api"
        : "http://localhost:3333"),
  },

  // --- Configuração exclusiva do empacotamento Capacitor (export estático) ---
  // O wrapper Android serve arquivos estáticos a partir de `out/`, então
  // habilitamos `output: 'export'` somente nesse caminho de build.
  ...(isCapExport
    ? {
        output: "export",
        // Sem servidor de imagens no app empacotado.
        images: { unoptimized: true },
        // URLs com barra final → casam com a estrutura de pastas do export.
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
