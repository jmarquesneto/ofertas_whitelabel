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
    // Incrementar invalida todas as sessões ativas do usuário
    sessionVersion: integer("session_version").notNull().default(1),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_uq").on(sql`lower(${t.email})`)],
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
    primaryColor: varchar("primary_color", { length: 7 }).notNull().default("#C2410C"),
    secondaryColor: varchar("secondary_color", { length: 7 }).notNull().default("#14423C"),
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
/* Ofertas                                                             */
/* ------------------------------------------------------------------ */
export const offers = pgTable(
  "offers",
  {
    id: serial("id").primaryKey(),
    platformId: integer("platform_id")
      .notNull()
      .references(() => platforms.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
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
export const offersRelations = relations(offers, ({ one, many }) => ({
  platform: one(platforms, { fields: [offers.platformId], references: [platforms.id] }),
  clicks: many(clicks),
}));
export const clicksRelations = relations(clicks, ({ one }) => ({
  offer: one(offers, { fields: [clicks.offerId], references: [offers.id] }),
}));

export type Offer = typeof offers.$inferSelect;
export type Platform = typeof platforms.$inferSelect;
export type SiteSettings = typeof siteSettings.$inferSelect;
export type User = typeof users.$inferSelect;
