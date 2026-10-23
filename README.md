# Vitrine White Label — ofertas e links de afiliados

Next.js 15 (App Router) · TypeScript · Tailwind CSS · PostgreSQL 16 · Drizzle ORM · 2FA TOTP · Docker/Portainer

## Por que esta stack

| Escolha | Motivo |
| --- | --- |
| **Next.js 15 full‑stack** | Vitrine (SSR, rápida, boa para SEO) e painel no mesmo container. Server Actions = controllers sem API REST duplicada. |
| **PostgreSQL** | Índices parciais, `count(*) filter`, `generate_series` para a série diária de cliques, `CHECK` nas cores hex, índice único em `lower(email)`. |
| **Drizzle ORM** | Sem binário de engine (imagem menor que Prisma), SQL tipado, migrações em SQL puro versionadas em `/drizzle`. |
| **Tailwind + variáveis CSS** | `bg-primary`, `text-secondary/80`… apontam para `rgb(var(--c-primary) / α)`. O layout injeta as cores do banco no `<html>` a cada requisição → white label real, sem rebuild. |

## Estrutura

```
vitrine/
├─ docker-compose.yml          # Stack do Portainer (app + postgres + volumes)
├─ Dockerfile                  # multi-stage, Next standalone, usuário não-root
├─ .env.example
├─ drizzle/0000_init.sql       # migração gerada (aplicada sozinha no boot)
├─ drizzle.config.ts
├─ tailwind.config.ts          # cores de marca = variáveis CSS
├─ public/robots.txt
└─ src/
   ├─ instrumentation.ts       # boot: roda migrações + seed (settings, plataformas)
   ├─ instrumentation-node.ts
   ├─ middleware.ts            # protege /admin/* (JWT no Edge)
   ├─ db/
   │  ├─ schema.ts             # MODELAGEM: users, site_settings, platforms, offers, clicks
   │  └─ index.ts              # pool pg + drizzle
   ├─ lib/
   │  ├─ auth.ts               # getCurrentUser / requireAdmin
   │  ├─ session.ts            # JWT (cookie pré-2FA e cookie de sessão)
   │  ├─ crypto.ts             # AES-256-GCM p/ segredo TOTP, hash de IP (LGPD)
   │  ├─ color.ts              # hex → canais RGB, cor de texto por contraste
   │  ├─ settings.ts           # leitura cacheada das configurações
   │  ├─ slug.ts               # slug único + rotas reservadas
   │  ├─ uploads.ts            # upload validado por assinatura de arquivo
   │  └─ rate-limit.ts
   ├─ server/
   │  ├─ actions/              # ← CONTROLLERS (Server Actions)
   │  │  ├─ auth.ts            #   cadastro, login, verificação TOTP, logout
   │  │  ├─ settings.ts        #   white label
   │  │  ├─ platforms.ts       #   CRUD plataformas
   │  │  └─ offers.ts          #   CRUD ofertas, renovar, pausar
   │  ├─ auth-helpers.ts       # setup do 2FA (não exposto ao navegador)
   │  └─ queries.ts            # consultas da vitrine e do analytics
   ├─ app/
   │  ├─ layout.tsx            # injeta cores/nome/favicon do banco
   │  ├─ page.tsx              # VITRINE: busca, filtros, grid (oculta expiradas)
   │  ├─ [slug]/route.ts       # REDIRECIONAMENTO + registro de clique (302)
   │  ├─ uploads/[...path]/route.ts
   │  ├─ favicon.ico/route.ts
   │  ├─ api/health/route.ts
   │  └─ admin/
   │     ├─ login · register · 2fa
   │     └─ (panel)/           # analytics, offers, platforms, settings
   └─ components/{public,admin}/
```

## Deploy no Portainer

1. Suba este projeto para um repositório Git (GitHub/GitLab, pode ser privado).
2. Portainer → **Stacks → Add stack → Repository**. Informe a URL do repo e `docker-compose.yml`.
3. Em **Environment variables**, preencha pelo menos `POSTGRES_PASSWORD`, `APP_SECRET` (`openssl rand -base64 48`) e `PUBLIC_URL`.
4. **Deploy the stack**. No primeiro boot o app cria as tabelas, a linha de configurações e 4 plataformas.
5. Acesse `https://seu-dominio/admin/register`, crie o primeiro administrador e escaneie o QR Code no Google Authenticator. Depois disso o cadastro se fecha sozinho (`ALLOW_REGISTRATION=false`).
6. Coloque um proxy reverso com HTTPS na frente (Nginx Proxy Manager, Traefik ou Cloudflare Tunnel) apontando para a porta 3000. Os cookies de sessão exigem HTTPS (`COOKIE_SECURE=true`).

Volumes: `vitrine_pgdata` (banco) e `vitrine_uploads` (logos, favicons e imagens). Backup do banco:
`docker exec vitrine-db pg_dump -U vitrine vitrine > backup.sql`

> O "Web editor" do Portainer não faz build. Nesse caso, publique a imagem (`docker build -t ghcr.io/voce/vitrine . && docker push …`) e troque `build:` por `image:` no compose.

## Desenvolvimento local

```bash
cp .env.example .env    # ajuste DATABASE_URL e UPLOAD_DIR
npm install
npm run dev             # migrações rodam no boot
npm run db:generate     # depois de alterar src/db/schema.ts
```

## Regras de negócio implementadas

- **Expiração**: cada oferta tem `expires_at` (padrão `now() + 72h`). A home filtra `expires_at > now()` em toda requisição, então nada de cron. No painel dá para renovar com um clique.
- **Link expirado compartilhado**: continua redirecionando para a loja (a comissão não se perde). Para bloquear, veja o comentário em `src/app/[slug]/route.ts`.
- **Clique**: `GET /<slug>` grava em `clicks` (hash do IP com sal, user-agent, referer) e incrementa `offers.clicks_count` numa transação executada **depois** da resposta (`after()`), então o redirecionamento não espera o banco. Bots, crawlers de preview (WhatsApp, Telegram, Facebook) e prefetch não contam.
- **302, não 301**: um 301 fica em cache no navegador, então cliques repetidos deixariam de ser contados e trocar o link bruto não teria efeito.
- **Slugs**: gerados do título (sem acento), únicos (`-2`, `-3`…), sem colidir com `admin`, `api`, `uploads` etc. Editar o título **não** muda o slug, para não quebrar links já divulgados.
- **2FA obrigatório**: senha correta gera só um cookie de 10 min (`stage=setup|totp`). A sessão (12h) só é emitida após o código TOTP. O segredo é guardado cifrado (AES-256-GCM). Login e TOTP têm rate limit.
- **Uploads**: tipo validado pela assinatura binária (não pelo nome), máx. 5 MB, nomes UUID, cache imutável. SVG é servido com CSP `sandbox` para não executar script.

## Próximos passos sugeridos

- Gestão de usuários no painel (convidar admin, resetar 2FA, "sair de todos os dispositivos" via `session_version`).
- Rate limit em Redis se rodar mais de uma réplica.
- Particionar/expurgar `clicks` com mais de 12 meses se o volume crescer.
