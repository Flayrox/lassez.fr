import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- About Global
    CREATE TABLE IF NOT EXISTS "about" (
      "id" serial PRIMARY KEY NOT NULL,
      "title" varchar NOT NULL DEFAULT 'Le Manifeste',
      "version" varchar DEFAULT 'Document Fondateur v.1.0',
      "content" jsonb,
      "quote" varchar DEFAULT '"L’avenir est antifasciste."',
      "signature_line1" varchar DEFAULT 'Rédigé par le Collectif L''Assez.',
      "signature_line2" varchar DEFAULT 'Paris, France.',
      "updated_at" timestamp(3) with time zone DEFAULT now(),
      "created_at" timestamp(3) with time zone DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "about_team" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "role" varchar NOT NULL,
      "avatar_id" integer
    );

    ALTER TABLE "about_team" ADD CONSTRAINT "about_team_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "about_team" ADD CONSTRAINT "about_team_avatar_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    CREATE INDEX IF NOT EXISTS "about_team_order_idx" ON "about_team" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "about_team_parent_id_idx" ON "about_team" USING btree ("_parent_id");

    -- Legal Global
    CREATE TABLE IF NOT EXISTS "legal" (
      "id" serial PRIMARY KEY NOT NULL,
      "title" varchar NOT NULL DEFAULT 'Mentions Légales',
      "last_updated" varchar DEFAULT 'Mises à jour annuellement.',
      "updated_at" timestamp(3) with time zone DEFAULT now(),
      "created_at" timestamp(3) with time zone DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "legal_sections" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" varchar NOT NULL,
      "content" jsonb NOT NULL
    );

    ALTER TABLE "legal_sections" ADD CONSTRAINT "legal_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."legal"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX IF NOT EXISTS "legal_sections_order_idx" ON "legal_sections" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "legal_sections_parent_id_idx" ON "legal_sections" USING btree ("_parent_id");

    -- Settings manifest update
    ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "manifest_site_name" varchar DEFAULT 'L''Assez';
    ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "manifest_short_name" varchar DEFAULT 'L''Assez';
    ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "manifest_description" varchar DEFAULT 'Journalisme d''investigation indépendant.';
    ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "manifest_theme_color" varchar DEFAULT '#ff0000';
    ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "manifest_background_color" varchar DEFAULT '#ffffff';
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "legal_sections" CASCADE;
    DROP TABLE IF EXISTS "legal" CASCADE;
    DROP TABLE IF EXISTS "about_team" CASCADE;
    DROP TABLE IF EXISTS "about" CASCADE;
    
    ALTER TABLE "settings" DROP COLUMN IF EXISTS "manifest_site_name";
    ALTER TABLE "settings" DROP COLUMN IF EXISTS "manifest_short_name";
    ALTER TABLE "settings" DROP COLUMN IF EXISTS "manifest_description";
    ALTER TABLE "settings" DROP COLUMN IF EXISTS "manifest_theme_color";
    ALTER TABLE "settings" DROP COLUMN IF EXISTS "manifest_background_color";
  `)
}
