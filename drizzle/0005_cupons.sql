CREATE TABLE "coupon_clicks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"platform_id" integer NOT NULL,
	"ip_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform_id" integer NOT NULL,
	"code" varchar(60) NOT NULL,
	"description" varchar(200),
	"min_value" numeric(10, 2),
	"expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"jid" varchar(80) NOT NULL,
	"name" varchar(120) NOT NULL,
	"send_offers" boolean DEFAULT true NOT NULL,
	"send_coupons" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "whatsapp_sends" ALTER COLUMN "offer_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "platforms" ADD COLUMN "coupon_banner_path" varchar(500);--> statement-breakpoint
ALTER TABLE "platforms" ADD COLUMN "coupon_url" text;--> statement-breakpoint
ALTER TABLE "whatsapp_sends" ADD COLUMN "kind" varchar(10) DEFAULT 'offer' NOT NULL;--> statement-breakpoint
ALTER TABLE "whatsapp_sends" ADD COLUMN "platform_id" integer;--> statement-breakpoint
ALTER TABLE "whatsapp_sends" ADD COLUMN "coupon_ids" jsonb;--> statement-breakpoint
ALTER TABLE "whatsapp_sends" ADD COLUMN "group_jid" varchar(80);--> statement-breakpoint
ALTER TABLE "coupon_clicks" ADD CONSTRAINT "coupon_clicks_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coupon_clicks_platform_time_idx" ON "coupon_clicks" USING btree ("platform_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_platform_code_uq" ON "coupons" USING btree ("platform_id","code");--> statement-breakpoint
CREATE INDEX "coupons_live_idx" ON "coupons" USING btree ("is_active","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_groups_jid_uq" ON "whatsapp_groups" USING btree ("jid");--> statement-breakpoint
ALTER TABLE "whatsapp_sends" ADD CONSTRAINT "whatsapp_sends_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_sends" ADD CONSTRAINT "whatsapp_sends_kind" CHECK ("whatsapp_sends"."kind" in ('offer', 'coupons'));--> statement-breakpoint
INSERT INTO "whatsapp_groups" ("jid", "name", "send_offers", "send_coupons") SELECT "group_jid", 'Grupo de ofertas', true, true FROM "whatsapp_settings" WHERE "group_jid" <> '' ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "whatsapp_sends" SET "group_jid" = (SELECT "group_jid" FROM "whatsapp_settings" WHERE "id" = 1) WHERE "group_jid" IS NULL;--> statement-breakpoint
INSERT INTO "role_permissions" ("role", "page") VALUES ('moderator','coupons'),('poster','coupons') ON CONFLICT DO NOTHING;