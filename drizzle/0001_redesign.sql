CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"parent_id" integer,
	"name" varchar(80) NOT NULL,
	"slug" varchar(90) NOT NULL,
	"icon" varchar(40) DEFAULT 'tag' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_settings" ALTER COLUMN "primary_color" SET DEFAULT '#FFC107';--> statement-breakpoint
ALTER TABLE "site_settings" ALTER COLUMN "secondary_color" SET DEFAULT '#111827';--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "category_id" integer;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "original_price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "is_featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "hero_title" varchar(120) DEFAULT 'As melhores ofertas,' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "hero_highlight" varchar(80) DEFAULT 'todos os dias!' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "hero_subtitle" varchar(240) DEFAULT 'A gente garimpa as melhores promoções da internet para você economizar sem perder tempo.' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "hero_image_path" varchar(255);--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "hero_badges" jsonb DEFAULT '[{"icon":"tag","label":"Ofertas conferidas"},{"icon":"shield-check","label":"Lojas verificadas"},{"icon":"truck","label":"Entrega para todo o Brasil"}]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "affiliate_title" varchar(120) DEFAULT 'Somos uma página de afiliados' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "affiliate_text" text DEFAULT 'Indicamos ofertas de lojas parceiras. Quando você compra pelos nossos links, a loja nos paga uma pequena comissão — e você não paga nada a mais por isso. É assim que mantemos o site no ar.' NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_uq" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "categories_parent_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "offers_category_idx" ON "offers" USING btree ("category_id");