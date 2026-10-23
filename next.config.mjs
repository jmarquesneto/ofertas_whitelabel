/** @type {import('next').NextConfig} */
const nextConfig = {
  // Gera um servidor Node mínimo em .next/standalone (imagem Docker enxuta)
  output: "standalone",
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // Uploads de logo/imagens passam por Server Actions
    serverActions: { bodySizeLimit: "6mb" },
  },
  // Pastas de migração são lidas em tempo de execução (instrumentation.ts)
  outputFileTracingIncludes: {
    "/*": ["./drizzle/**/*"],
  },
};

export default nextConfig;
