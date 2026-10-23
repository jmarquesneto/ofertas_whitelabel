CREATE TABLE "banners" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	"kind" varchar(10) DEFAULT 'text' NOT NULL,
	"headline" varchar(120),
	"highlight" varchar(80),
	"subtitle" varchar(240),
	"cta_label" varchar(40),
	"cta_url" varchar(500),
	"open_new_tab" boolean DEFAULT false NOT NULL,
	"image_path" varchar(500),
	"mobile_image_path" varchar(500),
	"bg_color" varchar(7),
	"show_badges" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "banners_kind" CHECK ("banners"."kind" in ('text', 'image')),
	CONSTRAINT "banners_bg_hex" CHECK ("banners"."bg_color" is null or "banners"."bg_color" ~ '^#[0-9A-Fa-f]{6}$')
);
--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "banner_interval_sec" integer DEFAULT 6 NOT NULL;--> statement-breakpoint
CREATE INDEX "banners_live_idx" ON "banners" USING btree ("is_active","sort_order");--> statement-breakpoint
-- Dados: o hero que já existia vira o primeiro banner (instalações existentes)
INSERT INTO "banners" ("name", "kind", "headline", "highlight", "subtitle", "cta_label", "cta_url", "image_path", "sort_order")
SELECT 'Banner principal', 'text', "hero_title", "hero_highlight", "hero_subtitle", 'Ver ofertas', '#ofertas', "hero_image_path", 1
FROM "site_settings" WHERE "id" = 1;
