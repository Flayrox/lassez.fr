import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Collection « Élections » — remplace les tables legacy SQLite
 * (elections_registry, election_sources, election_daemon_config,
 * election_front_display). Une entrée = un scrutin, avec ses jeux de
 * données data.gouv (table array elections_datasets).
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  DO $$ BEGIN
    CREATE TYPE "public"."enum_elections_category" AS ENUM('municipales', 'presidentielles', 'legislatives', 'europeennes', 'regionales', 'departementales', 'referendum', 'autre');
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum_elections_status" AS ENUM('draft', 'active', 'done');
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum_elections_source_type" AS ENUM('dataset-api', 'manual');
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum_elections_datasets_role" AS ENUM('results_first_tour', 'results_second_tour', 'candidates_first_tour', 'candidates_second_tour');
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  `)
  await db.execute(sql`
  CREATE TABLE IF NOT EXISTS "elections" (
      "id" serial PRIMARY KEY NOT NULL,
      "label" varchar NOT NULL,
      "slug" varchar NOT NULL,
      "category" "enum_elections_category" DEFAULT 'municipales',
      "status" "enum_elections_status" DEFAULT 'draft',
      "source_type" "enum_elections_source_type" DEFAULT 'dataset-api',
      "parser_strategy" varchar,
      "daemon_enabled" boolean DEFAULT false,
      "live_mode_enabled" boolean DEFAULT false,
      "sync_locked" boolean DEFAULT false,
      "interval_enabled" boolean DEFAULT false,
      "interval_hours" numeric DEFAULT 0.5,
      "poll_interval_minutes" numeric DEFAULT 2,
      "schedule_enabled" boolean DEFAULT false,
      "schedule_times" varchar,
      "is_visible" boolean DEFAULT false,
      "is_featured" boolean DEFAULT false,
      "display_order" numeric DEFAULT 1,
      "hide_after_date" timestamptz,
      "updated_at" timestamptz DEFAULT now() NOT NULL,
      "created_at" timestamptz DEFAULT now() NOT NULL
  );
  `)
  await db.execute(sql`
  CREATE TABLE IF NOT EXISTS "elections_datasets" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "role" "enum_elections_datasets_role" NOT NULL,
      "dataset_slug" varchar NOT NULL,
      "last_url" varchar,
      "last_success" boolean DEFAULT false,
      "last_error" varchar
  );
  `)
  await db.execute(sql`
  ALTER TABLE "elections" ADD CONSTRAINT "elections_slug_idx" UNIQUE ("slug");
  ALTER TABLE "elections_datasets" ADD CONSTRAINT "elections_datasets_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."elections"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX IF NOT EXISTS "elections_datasets_order_idx" ON "elections_datasets" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "elections_datasets_parent_id_idx" ON "elections_datasets" USING btree ("_parent_id");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP TABLE IF EXISTS "elections_datasets" CASCADE;
  DROP TABLE IF EXISTS "elections" CASCADE;
  DROP TYPE IF EXISTS "public"."enum_elections_datasets_role";
  DROP TYPE IF EXISTS "public"."enum_elections_source_type";
  DROP TYPE IF EXISTS "public"."enum_elections_status";
  DROP TYPE IF EXISTS "public"."enum_elections_category";
  `)
}
