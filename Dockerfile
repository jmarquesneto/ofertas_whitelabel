# syntax=docker/dockerfile:1.7
# ---------- 1. dependências ----------
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------- 2. build ----------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# O build não acessa o banco (todas as páginas são dinâmicas)
RUN npm run build

# ---------- 3. runtime ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UPLOAD_DIR=/app/uploads

RUN apk add --no-cache tzdata wget \
 && addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs \
 && mkdir -p /app/uploads && chown -R nextjs:nodejs /app/uploads

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Migrações SQL aplicadas automaticamente no boot (src/instrumentation.ts)
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle

# Permite rodar com qualquer PUID/PGID (user: no compose, padrão do OMV)
RUN chmod -R a+rwX /app/.next /app/uploads

USER nextjs
EXPOSE 3000
VOLUME ["/app/uploads"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
