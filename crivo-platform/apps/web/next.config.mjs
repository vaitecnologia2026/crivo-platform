/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@crivo/types'],
  env: {
    NEXT_PUBLIC_API_URL: process.env.API_URL ?? 'http://localhost:3333',
  },
};

export default nextConfig;
