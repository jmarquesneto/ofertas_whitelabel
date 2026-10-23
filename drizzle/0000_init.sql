CREATE TABLE "clicks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"offer_id" integer NOT NULL,
	"ip_hash" varchar(64),
	"user_agent" varchar(400),
	"referer" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform_id" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"slug" varchar(120) NOT NULL,
	"affiliate_url" text NOT NULL,
	"coupon" varchar(60),
	"image_path" varchar(500),
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"clicks_count" integer DEFAULT 0 NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platforms" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	"slug" varchar(90) NOT NULL,
	"logo_path" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"site_name" varchar(80) DEFAULT 'Minha Vitrine' NOT NULL,
	"tagline" varchar(160),
	"logo_path" varchar(255),
	"favicon_path" varchar(255),
	"primary_color" varchar(7) DEFAULT '#C2410C' NOT NULL,
	"secondary_color" varchar(7) DEFAULT '#14423C' NOT NULL,
	"footer_text" text DEFAULT 'Este site participa de programas de afiliados e pode receber comissão por compras realizadas através dos links. Preços e disponibilidade podem mudar sem aviso; confira sempre na loja.' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_settings_singleton" CHECK ("site_settings"."id" = 1),
	CONSTRAINT "site_settings_primary_hex" CHECK ("site_settings"."primary_color" ~ '^#[0-9A-Fa-f]{6}$'),
	CONSTRAINT "site_settings_secondary_hex" CHECK ("site_settings"."secondary_color" ~ '^#[0-9A-Fa-f]{6}$')
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"email" varchar(190) NOT NULL,
	"password_hash" varchar(100) NOT NULL,
	"totp_secret_enc" text,
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"session_version" integer DEFAULT 1 NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clicks" ADD CONSTRAINT "clicks_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clicks_offer_time_idx" ON "clicks" USING btree ("offer_id","created_at");--> statement-breakpoint
CREATE INDEX "clicks_time_idx" ON "clicks" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "offers_slug_uq" ON "offers" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "offers_home_idx" ON "offers" USING btree ("is_active","expires_at");--> statement-breakpoint
CREATE INDEX "offers_platform_idx" ON "offers" USING btree ("platform_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platforms_slug_uq" ON "platforms" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree (lower("email"));