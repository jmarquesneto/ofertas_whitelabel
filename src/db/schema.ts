import {
  pgTable,
  serial,
  integer,
  bigserial,
  varchar,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  check,
  numeric,
  jsonb,
  primaryKey,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

/* ------------------------------------------------------------------ */
/* Usuários do painel (2FA TOTP obrigatório)                           */
/* ------------------------------------------------------------------ */
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 190 }).notNull(),
    passwordHash: varchar("password_hash", { length: 100 }).notNull(),
    // Segredo TOTP cifrado com AES-256-GCM (APP_SECRET). Nunca em texto puro.
    totpSecretEnc: text("totp_secret_enc"),
    totpEnabled: boolean("totp_enabled").notNull().default(false),
    // Grupo: admin | moderator | poster (permissões por página em role_permissions)
    role: varchar("role", { length: 20 }).notNull().default("poster"),
    isBlocked: boolean("is_blocked").notNull().default(false),
    // Depois de um reset feito pelo administrador, obriga a criar nova senha
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    // Incrementar invalida todas as sessões ativas do usuário
    sessionVersion: integer("session_version").notNull().default(1),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_email_uq").on(sql`lower(${t.email})`),
    check("users_role", sql`${t.role} in ('admin', 'moderator', 'poster')`),
  ],
);

/* Códigos de recuperação do 2FA (guardados só como hash; cada um vale uma vez) */
export const backupCodes = pgTable(
  "backup_codes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    codeHash: varchar("code_hash", { length: 64 }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("backup_codes_user_idx").on(t.userId)],
);

/* Páginas que cada grupo pode ver (linha existe = permitido). Admin vê tudo. */
export const rolePermissions = pgTable(
  "role_permissions",
  {
    role: varchar("role", { length: 20 }).notNull(),
    page: varchar("page", { length: 30 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.role, t.page] })],
);

/* ------------------------------------------------------------------ */
/* Configurações white label — linha única (id = 1)                    */
/* ------------------------------------------------------------------ */
export const siteSettings = pgTable(
  "site_settings",
  {
    id: integer("id").primaryKey().default(1),
    siteName: varchar("site_name", { length: 80 }).notNull().default("Minha Vitrine"),
    tagline: varchar("tagline", { length: 160 }),
    logoPath: varchar("logo_path", { length: 255 }),
    faviconPath: varchar("favicon_path", { length: 255 }),
    primaryColor: varchar("primary_color", { length: 7 }).notNull().default("#FFC107"),
    secondaryColor: varchar("secondary_color", { length: 7 }).notNull().default("#111827"),
    // Hero da home (white label)
    heroTitle: varchar("hero_title", { length: 120 }).notNull().default("As melhores ofertas,"),
    heroHighlight: varchar("hero_highlight", { length: 80 }).notNull().default("todos os dias!"),
    heroSubtitle: varchar("hero_subtitle", { length: 240 })
      .notNull()
      .default("A gente garimpa as melhores promoções da internet para você economizar sem perder tempo."),
    heroImagePath: varchar("hero_image_path", { length: 255 }),
    heroBadges: jsonb("hero_badges")
      .$type<{ icon: string; label: string }[]>()
      .notNull()
      .default([
        { icon: "tag", label: "Ofertas conferidas" },
        { icon: "shield-check", label: "Lojas verificadas" },
        { icon: "truck", label: "Entrega para todo o Brasil" },
      ]),
    // Tempo de troca do carrossel de banners (segundos)
    bannerIntervalSec: integer("banner_interval_sec").notNull().default(6),
    // Faixa "somos afiliados" (substitui a newsletter da referência)
    affiliateTitle: varchar("affiliate_title", { length: 120 })
      .notNull()
      .default("Somos uma página de afiliados"),
    affiliateText: text("affiliate_text")
      .notNull()
      .default(
        "Indicamos ofertas de lojas parceiras. Quando você compra pelos nossos links, a loja nos paga uma pequena comissão — e você não paga nada a mais por isso. É assim que mantemos o site no ar.",
      ),
    footerText: text("footer_text")
      .notNull()
      .default(
        "Este site participa de programas de afiliados e pode receber comissão por compras realizadas através dos links. Preços e disponibilidade podem mudar sem aviso; confira sempre na loja.",
      ),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("site_settings_singleton", sql`${t.id} = 1`),
    check("site_settings_primary_hex", sql`${t.primaryColor} ~ '^#[0-9A-Fa-f]{6}$'`),
    check("site_settings_secondary_hex", sql`${t.secondaryColor} ~ '^#[0-9A-Fa-f]{6}$'`),
  ],
);

/* ------------------------------------------------------------------ */
/* Plataformas de afiliação (Shopee, Mercado Livre, Amazon…)           */
/* ------------------------------------------------------------------ */
export const platforms = pgTable(
  "platforms",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 80 }).notNull(),
    slug: varchar("slug", { length: 90 }).notNull(),
    logoPath: varchar("logo_path", { length: 255 }),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("platforms_slug_uq").on(t.slug)],
);

/* ------------------------------------------------------------------ */
/* Banners do topo da home (carrossel)                                 */
/*  kind = "text"  → título/destaque/subtítulo/botão + imagem/mascote  */
/*  kind = "image" → arte pronta (desktop + celular) com link          */
/* ------------------------------------------------------------------ */
export const banners = pgTable(
  "banners",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 80 }).notNull(), // nome interno no painel
    kind: varchar("kind", { length: 10 }).notNull().default("text"),
    headline: varchar("headline", { length: 120 }),
    highlight: varchar("highlight", { length: 80 }),
    subtitle: varchar("subtitle", { length: 240 }),
    ctaLabel: varchar("cta_label", { length: 40 }),
    ctaUrl: varchar("cta_url", { length: 500 }),
    openNewTab: boolean("open_new_tab").notNull().default(false),
    imagePath: varchar("image_path", { length: 500 }), // mascote (texto) ou arte desktop (imagem)
    mobileImagePath: varchar("mobile_image_path", { length: 500 }), // arte do celular (imagem)
    bgColor: varchar("bg_color", { length: 7 }), // vazio = cor secundária da marca
    showBadges: boolean("show_badges").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("banners_live_idx").on(t.isActive, t.sortOrder),
    check("banners_kind", sql`${t.kind} in ('text', 'image')`),
    check("banners_bg_hex", sql`${t.bgColor} is null or ${t.bgColor} ~ '^#[0-9A-Fa-f]{6}$'`),
  ],
);

/* ------------------------------------------------------------------ */
/* Categorias (2 níveis: categoria → subcategoria)                     */
/* ------------------------------------------------------------------ */
export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    parentId: integer("parent_id").references((): AnyPgColumn => categories.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    slug: varchar("slug", { length: 90 }).notNull(),
    icon: varchar("icon", { length: 40 }).notNull().default("tag"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("categories_slug_uq").on(t.slug), index("categories_parent_idx").on(t.parentId)],
);

/* ------------------------------------------------------------------ */
/* Ofertas                                                             */
/* ------------------------------------------------------------------ */
export const offers = pgTable(
  "offers",
  {
    id: serial("id").primaryKey(),
    platformId: integer("platform_id")
      .notNull()
      .references(() => platforms.id, { onDelete: "restrict" }),
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    price: numeric("price", { precision: 10, scale: 2 }),
    originalPrice: numeric("original_price", { precision: 10, scale: 2 }),
    isFeatured: boolean("is_featured").notNull().default(false),
    slug: varchar("slug", { length: 120 }).notNull(),
    affiliateUrl: text("affiliate_url").notNull(), // "link bruto"
    coupon: varchar("coupon", { length: 60 }),
    imagePath: varchar("image_path", { length: 500 }), // /uploads/... ou URL externa
    isActive: boolean("is_active").notNull().default(true),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    clicksCount: integer("clicks_count").notNull().default(0), // contador desnormalizado
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("offers_slug_uq").on(t.slug),
    index("offers_home_idx").on(t.isActive, t.expiresAt),
    index("offers_platform_idx").on(t.platformId),
    index("offers_category_idx").on(t.categoryId),
  ],
);

/* ------------------------------------------------------------------ */
/* Cliques (analytics) — um registro por clique válido                 */
/* ------------------------------------------------------------------ */
export const clicks = pgTable(
  "clicks",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    offerId: integer("offer_id")
      .notNull()
      .references(() => offers.id, { onDelete: "cascade" }),
    ipHash: varchar("ip_hash", { length: 64 }), // SHA-256 com sal; LGPD: não guardamos o IP
    userAgent: varchar("user_agent", { length: 400 }),
    referer: varchar("referer", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("clicks_offer_time_idx").on(t.offerId, t.createdAt), index("clicks_time_idx").on(t.createdAt)],
);

/* Relações (para queries com `with`) */
export const platformsRelations = relations(platforms, ({ many }) => ({ offers: many(offers) }));
export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, { fields: [categories.parentId], references: [categories.id], relationName: "tree" }),
  children: many(categories, { relationName: "tree" }),
  offers: many(offers),
}));
export const offersRelations = relations(offers, ({ one, many }) => ({
  platform: one(platforms, { fields: [offers.platformId], references: [platforms.id] }),
  category: one(categories, { fields: [offers.categoryId], references: [categories.id] }),
  clicks: many(clicks),
}));
export const clicksRelations = relations(clicks, ({ one }) => ({
  offer: one(offers, { fields: [clicks.offerId], references: [offers.id] }),
}));

export type Offer = typeof offers.$inferSelect;
export type Platform = typeof platforms.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Banner = typeof banners.$inferSelect;
export type SiteSettings = typeof siteSettings.$inferSelect;
export type User = typeof users.$inferSelect;
