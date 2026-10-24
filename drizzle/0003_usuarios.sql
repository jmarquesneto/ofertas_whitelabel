CREATE TABLE "backup_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"code_hash" varchar(64) NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role" varchar(20) NOT NULL,
	"page" varchar(30) NOT NULL,
	CONSTRAINT "role_permissions_role_page_pk" PRIMARY KEY("role","page")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" varchar(20) DEFAULT 'poster' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_blocked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "backup_codes" ADD CONSTRAINT "backup_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "backup_codes_user_idx" ON "backup_codes" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role" CHECK ("users"."role" in ('admin', 'moderator', 'poster'));--> statement-breakpoint
-- Quem já existia vira administrador (até hoje todo usuário tinha acesso total)
UPDATE "users" SET "role" = 'admin';--> statement-breakpoint
-- Permissões padrão dos grupos
INSERT INTO "role_permissions" ("role", "page") VALUES
  ('moderator', 'analytics'), ('moderator', 'offers'), ('moderator', 'banners'), ('moderator', 'categories'), ('moderator', 'platforms'),
  ('poster', 'offers');
