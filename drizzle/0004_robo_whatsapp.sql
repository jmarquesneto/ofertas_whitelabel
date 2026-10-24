CREATE TABLE "bot_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"mode" varchar(10) DEFAULT 'review' NOT NULL,
	"interval_minutes" integer DEFAULT 45 NOT NULL,
	"max_per_cycle" integer DEFAULT 3 NOT NULL,
	"spacing_seconds" integer DEFAULT 120 NOT NULL,
	"no_repeat_days" integer DEFAULT 7 NOT NULL,
	"active_from" varchar(5) DEFAULT '08:00' NOT NULL,
	"active_to" varchar(5) DEFAULT '23:00' NOT NULL,
	"min_discount" integer DEFAULT 25 NOT NULL,
	"max_discount" integer DEFAULT 100 NOT NULL,
	"min_price" numeric(10, 2),
	"max_price" numeric(10, 2),
	"blocked_words" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"niches" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sources" jsonb NOT NULL,
	"status" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bot_settings_singleton" CHECK ("bot_settings"."id" = 1),
	CONSTRAINT "bot_settings_mode" CHECK ("bot_settings"."mode" in ('review', 'direct'))
);
--> statement-breakpoint
CREATE TABLE "whatsapp_sends" (
	"id" serial PRIMARY KEY NOT NULL,
	"offer_id" integer NOT NULL,
	"status" varchar(10) DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "whatsapp_sends_status" CHECK ("whatsapp_sends"."status" in ('queued', 'sending', 'sent', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "whatsapp_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"base_url" varchar(300) DEFAULT 'http://evolution-api:8080' NOT NULL,
	"api_key_enc" text,
	"instance" varchar(80) DEFAULT '' NOT NULL,
	"group_jid" varchar(80) DEFAULT '' NOT NULL,
	"min_gap_seconds" integer DEFAULT 60 NOT NULL,
	"send_image" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_settings_singleton" CHECK ("whatsapp_settings"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "source" varchar(10) DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "external_id" varchar(140);--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "review_status" varchar(10);--> statement-breakpoint
ALTER TABLE "whatsapp_sends" ADD CONSTRAINT "whatsapp_sends_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "whatsapp_sends_status_idx" ON "whatsapp_sends" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "whatsapp_sends_offer_idx" ON "whatsapp_sends" USING btree ("offer_id");--> statement-breakpoint
CREATE INDEX "offers_external_idx" ON "offers" USING btree ("external_id","created_at");--> statement-breakpoint
CREATE INDEX "offers_review_idx" ON "offers" USING btree ("review_status");--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_source" CHECK ("offers"."source" in ('manual', 'bot'));--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_review_status" CHECK ("offers"."review_status" is null or "offers"."review_status" in ('pending', 'rejected'));--> statement-breakpoint
INSERT INTO "role_permissions" ("role", "page") VALUES ('moderator','approval') ON CONFLICT DO NOTHING;