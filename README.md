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
├─ docker-compose.yml          # Stack do Portainer (app + postgres, caminhos absolutos)
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

## Deploy no Portainer (OMV)

1. **Crie as pastas** no OMV (via SSH), num disco ext4/btrfs:
   ```bash
   mkdir -p /srv/dev-disk-by-uuid-XXXX/appdata/vitrine/{postgres,uploads}
   chown -R 1000:100 /srv/dev-disk-by-uuid-XXXX/appdata/vitrine/uploads   # mesmo PUID:PGID do .env
   ```
   A pasta `postgres/` não precisa de chown (a imagem do Postgres ajusta sozinha).
2. **Escolha uma porta livre**: `ss -tlnp | grep -E ':3080\b'` (sem saída = livre). Também dá para ver em Portainer → Containers → coluna "Published Ports".
3. Portainer → **Stacks → Add stack → Web editor** e cole o `docker-compose.yml`. A imagem do app (`ghcr.io/jmarquesneto/ofertas_whitelabel:latest`) é compilada pelo GitHub Actions a cada push na `main`; o Portainer só baixa.
4. Em **Environment variables**, preencha no mínimo `APPDATA_PATH`, `PUID`, `PGID`, `APP_PORT`, `POSTGRES_PASSWORD`, `APP_SECRET` (`openssl rand -base64 48`) e `PUBLIC_URL`.
5. **Deploy the stack.** No primeiro boot o app cria as tabelas, a linha de configurações e 4 plataformas.
6. Acesse `http://IP-DO-OMV:APP_PORT/admin/register` (com `COOKIE_SECURE=false` enquanto não houver HTTPS), crie o administrador e escaneie o QR Code.
7. Proxy reverso com HTTPS apontando para `IP-DO-OMV:APP_PORT`, depois volte `COOKIE_SECURE=true`.

**Porta ocupada?** Troque apenas `APP_PORT` e faça "Update the stack". A porta interna do container (3000) nunca muda, e o banco não publica porta nenhuma, então não disputa a 5432 com outro Postgres que você já tenha.

**Atualizar**: depois de um push, espere o workflow "Docker image" ficar verde em *Actions* e, no Portainer, abra a stack → **Update the stack** com **Re-pull image** ligado.

**Backup**: copie a pasta `APPDATA_PATH` com a stack parada, ou, com ela rodando:
`docker exec vitrine-db pg_dump -U vitrine vitrine > backup.sql`

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
