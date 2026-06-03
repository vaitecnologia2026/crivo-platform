import { resolve } from "node:path";

// Raiz do monorepo (necessária para o pnpm resolver pacotes workspace).
const monorepoRoot = resolve(import.meta.dirname, "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@crivo/types", "@crivo/ui"],
  turbopack: { root: monorepoRoot },
  env: {
    NEXT_PUBLIC_API_URL: process.env.API_URL ?? "http://localhost:3333",
  },
};

export default nextConfig;
