/** @type {import('next').NextConfig} */
const nextConfig = {
  // Gera um servidor Node mínimo em .next/standalone (imagem Docker enxuta)
  output: "standalone",
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // Uploads passam por Server Actions. Limite alto aqui; o limite real (UPLOAD_MAX_MB)
    // é checado no navegador e no servidor com mensagem amigável.
    serverActions: { bodySizeLimit: "20mb" },
  },
  // Pastas de migração são lidas em tempo de execução (instrumentation.ts)
  outputFileTracingIncludes: {
    "/*": ["./drizzle/**/*"],
  },
};

export default nextConfig;
