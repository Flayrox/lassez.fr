import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Ajout des collections Radar (Phase 1 de l'unification daemon → Payload) :
 * signals, sources, publications, seen-urls, taxonomy-templates, logs
 * et le global radar-settings.
 *
 * Migration écrite manuellement à partir du SQL généré par drizzle-kit
 * (seules les tables radar sont incluses — pas le drift préexistant).
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TYPE "public"."enum_signals_status" AS ENUM('INGESTED', 'RESEARCHED', 'DRAFTED', 'VALIDATED', 'PENDING', 'QUEUED', 'PUBLISHED', 'REJECTED', 'REJECTED_ERROR', 'FAILED');
  CREATE TYPE "public"."enum_sources_type" AS ENUM('RSS', 'TELEGRAM', 'GOOGLE_NEWS');
  CREATE TYPE "public"."enum_sources_health_status" AS ENUM('OK', 'ERROR', 'TIMEOUT');
  CREATE TYPE "public"."enum_publications_status" AS ENUM('PENDING', 'PUBLISHED', 'FAILED');
  CREATE TYPE "public"."enum_logs_level" AS ENUM('INFO', 'WARN', 'ERROR', 'SUCCESS');
  CREATE TYPE "public"."enum_radar_settings_discord_publish_mode" AS ENUM('DIRECT', 'SCHEDULED');
  CREATE TYPE "public"."enum_radar_settings_x_publish_mode" AS ENUM('DIRECT', 'SCHEDULED');
  CREATE TYPE "public"."enum_radar_settings_bluesky_publish_mode" AS ENUM('DIRECT', 'SCHEDULED');
  CREATE TYPE "public"."enum_radar_settings_mastodon_publish_mode" AS ENUM('DIRECT', 'SCHEDULED');
  CREATE TYPE "public"."enum_radar_settings_payload_publish_mode" AS ENUM('DIRECT', 'SCHEDULED');
  CREATE TYPE "public"."enum_radar_settings_scheduling_mode" AS ENUM('pulse', 'calendar', 'hybrid');

  CREATE TABLE "signals" (
    "id" serial PRIMARY KEY NOT NULL,
    "source_title" varchar,
    "raw_data" jsonb,
    "final_draft" jsonb,
    "status" "enum_signals_status" DEFAULT 'INGESTED' NOT NULL,
    "taxonomy" varchar,
    "tags" jsonb,
    "geo" varchar,
    "image_url" varchar,
    "scheduled_at" timestamp(3) with time zone,
    "published_at" timestamp(3) with time zone,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "sources" (
    "id" serial PRIMARY KEY NOT NULL,
    "url" varchar NOT NULL,
    "type" "enum_sources_type" NOT NULL,
    "source_name" varchar NOT NULL,
    "source_bias" varchar DEFAULT 'Indépendant',
    "trust_score" numeric DEFAULT 5 NOT NULL,
    "allow_source_images" boolean DEFAULT false,
    "active" boolean DEFAULT true,
    "health_status" "enum_sources_health_status" DEFAULT 'OK',
    "last_check_at" timestamp(3) with time zone,
    "error_message" varchar,
    "response_time" numeric,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "publications" (
    "id" serial PRIMARY KEY NOT NULL,
    "signal_id" integer NOT NULL,
    "platform" varchar NOT NULL,
    "status" "enum_publications_status" DEFAULT 'PENDING' NOT NULL,
    "scheduled_at" timestamp(3) with time zone NOT NULL,
    "published_at" timestamp(3) with time zone,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "seen_urls" (
    "id" serial PRIMARY KEY NOT NULL,
    "url" varchar NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "taxonomy_templates" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar NOT NULL,
    "display_name" varchar,
    "description" varchar,
    "format_instructions" varchar,
    "examples_json" jsonb,
    "output_schema_json" jsonb,
    "accent_color" varchar DEFAULT '#000000',
    "is_factory" boolean DEFAULT false,
    "active" boolean DEFAULT true,
    "sort_order" numeric DEFAULT 0,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "logs" (
    "id" serial PRIMARY KEY NOT NULL,
    "level" "enum_logs_level" DEFAULT 'INFO' NOT NULL,
    "message" varchar NOT NULL,
    "node_id" varchar,
    "timestamp" timestamp(3) with time zone NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "radar_settings" (
    "id" serial PRIMARY KEY NOT NULL,
    "enable_auto_publish" boolean DEFAULT true,
    "enable_payload_c_m_s" boolean DEFAULT true,
    "enable_discord" boolean DEFAULT true,
    "enable_x" boolean DEFAULT false,
    "enable_bluesky" boolean DEFAULT false,
    "enable_mastodon" boolean DEFAULT false,
    "discord_publish_mode" "enum_radar_settings_discord_publish_mode" DEFAULT 'DIRECT',
    "x_publish_mode" "enum_radar_settings_x_publish_mode" DEFAULT 'SCHEDULED',
    "bluesky_publish_mode" "enum_radar_settings_bluesky_publish_mode" DEFAULT 'SCHEDULED',
    "mastodon_publish_mode" "enum_radar_settings_mastodon_publish_mode" DEFAULT 'SCHEDULED',
    "payload_publish_mode" "enum_radar_settings_payload_publish_mode" DEFAULT 'DIRECT',
    "scheduling_mode" "enum_radar_settings_scheduling_mode" DEFAULT 'hybrid',
    "scraping_interval" numeric DEFAULT 60,
    "min_publish_delay" numeric DEFAULT 60,
    "max_publish_delay" numeric DEFAULT 120,
    "daemon_schedule" varchar DEFAULT '[]',
    "max_concurrent_tasks" numeric DEFAULT 5,
    "similarity_threshold" numeric DEFAULT 0.45,
    "dedup_lookback_hours" numeric DEFAULT 24,
    "ai_model_flash" varchar DEFAULT 'gemini-3.1-flash-lite-preview',
    "ai_model_pro" varchar DEFAULT 'gemini-3-flash-preview',
    "custom_prompt_modifier" varchar,
    "allow_source_images" boolean DEFAULT true,
    "base_identity_prompt" varchar,
    "research_mission_prompt" varchar,
    "vocabulary_rules_prompt" varchar,
    "image_rules_prompt" varchar,
    "researcher_system_prompt" varchar,
    "researcher_reject_criteria" varchar,
    "rss_feeds" varchar DEFAULT '[]',
    "telegram_channels" varchar DEFAULT '[]',
    "google_news_queries" varchar DEFAULT '[]',
    "keywords" varchar DEFAULT '[]',
    "banned_keywords" varchar DEFAULT '[]',
    "pipeline_graph_json" varchar,
    "discord_webhook_url" varchar,
    "x_api_key" varchar,
    "x_api_secret" varchar,
    "x_access_token" varchar,
    "x_access_secret" varchar,
    "mastodon_instance_url" varchar,
    "mastodon_access_token" varchar,
    "bluesky_identifier" varchar,
    "bluesky_app_password" varchar,
    "payload_server_url" varchar,
    "payload_bot_email" varchar,
    "payload_bot_password" varchar,
    "social_targets_by_type_json" varchar DEFAULT '{}',
    "available_models_json" varchar DEFAULT '[{"value":"gemini-3.1-pro-preview","label":"Gemini 3.1 Pro (Preview)"},{"value":"gemini-3-flash-preview","label":"Gemini 3 Flash (Preview)"},{"value":"gemini-3.1-flash-lite-preview","label":"Gemini 3.1 Flash-Lite"},{"value":"gemini-2.0-pro-exp","label":"Gemini 2.0 Pro Exp"}]',
    "updated_at" timestamp(3) with time zone,
    "created_at" timestamp(3) with time zone
  );

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "signals_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "sources_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "publications_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "seen_urls_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "taxonomy_templates_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "logs_id" integer;

  ALTER TABLE "publications" ADD CONSTRAINT "publications_signal_id_signals_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."signals"("id") ON DELETE set null ON UPDATE no action;

  CREATE INDEX "signals_status_idx" ON "signals" USING btree ("status");
  CREATE INDEX "signals_updated_at_idx" ON "signals" USING btree ("updated_at");
  CREATE INDEX "signals_created_at_idx" ON "signals" USING btree ("created_at");
  CREATE UNIQUE INDEX "sources_url_idx" ON "sources" USING btree ("url");
  CREATE INDEX "sources_active_idx" ON "sources" USING btree ("active");
  CREATE INDEX "sources_updated_at_idx" ON "sources" USING btree ("updated_at");
  CREATE INDEX "sources_created_at_idx" ON "sources" USING btree ("created_at");
  CREATE INDEX "publications_signal_idx" ON "publications" USING btree ("signal_id");
  CREATE INDEX "publications_status_idx" ON "publications" USING btree ("status");
  CREATE INDEX "publications_updated_at_idx" ON "publications" USING btree ("updated_at");
  CREATE INDEX "publications_created_at_idx" ON "publications" USING btree ("created_at");
  CREATE UNIQUE INDEX "seen_urls_url_idx" ON "seen_urls" USING btree ("url");
  CREATE INDEX "seen_urls_updated_at_idx" ON "seen_urls" USING btree ("updated_at");
  CREATE INDEX "seen_urls_created_at_idx" ON "seen_urls" USING btree ("created_at");
  CREATE UNIQUE INDEX "taxonomy_templates_name_idx" ON "taxonomy_templates" USING btree ("name");
  CREATE INDEX "taxonomy_templates_active_idx" ON "taxonomy_templates" USING btree ("active");
  CREATE INDEX "taxonomy_templates_updated_at_idx" ON "taxonomy_templates" USING btree ("updated_at");
  CREATE INDEX "taxonomy_templates_created_at_idx" ON "taxonomy_templates" USING btree ("created_at");
  CREATE INDEX "logs_level_idx" ON "logs" USING btree ("level");
  CREATE INDEX "logs_timestamp_idx" ON "logs" USING btree ("timestamp");
  CREATE INDEX "logs_updated_at_idx" ON "logs" USING btree ("updated_at");
  CREATE INDEX "logs_created_at_idx" ON "logs" USING btree ("created_at");

  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_signals_fk" FOREIGN KEY ("signals_id") REFERENCES "public"."signals"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sources_fk" FOREIGN KEY ("sources_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_publications_fk" FOREIGN KEY ("publications_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_seen_urls_fk" FOREIGN KEY ("seen_urls_id") REFERENCES "public"."seen_urls"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_taxonomy_templates_fk" FOREIGN KEY ("taxonomy_templates_id") REFERENCES "public"."taxonomy_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_logs_fk" FOREIGN KEY ("logs_id") REFERENCES "public"."logs"("id") ON DELETE cascade ON UPDATE no action;

  ALTER TABLE "signals" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "sources" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "publications" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "seen_urls" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "taxonomy_templates" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "logs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "radar_settings" DISABLE ROW LEVEL SECURITY;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "signals_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "sources_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "publications_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "seen_urls_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "taxonomy_templates_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "logs_id";

  DROP TABLE IF EXISTS "radar_settings" CASCADE;
  DROP TABLE IF EXISTS "logs" CASCADE;
  DROP TABLE IF EXISTS "taxonomy_templates" CASCADE;
  DROP TABLE IF EXISTS "seen_urls" CASCADE;
  DROP TABLE IF EXISTS "publications" CASCADE;
  DROP TABLE IF EXISTS "sources" CASCADE;
  DROP TABLE IF EXISTS "signals" CASCADE;
  DROP TYPE IF EXISTS "public"."enum_signals_status";
  DROP TYPE IF EXISTS "public"."enum_sources_type";
  DROP TYPE IF EXISTS "public"."enum_sources_health_status";
  DROP TYPE IF EXISTS "public"."enum_publications_status";
  DROP TYPE IF EXISTS "public"."enum_logs_level";
  DROP TYPE IF EXISTS "public"."enum_radar_settings_discord_publish_mode";
  DROP TYPE IF EXISTS "public"."enum_radar_settings_x_publish_mode";
  DROP TYPE IF EXISTS "public"."enum_radar_settings_bluesky_publish_mode";
  DROP TYPE IF EXISTS "public"."enum_radar_settings_mastodon_publish_mode";
  DROP TYPE IF EXISTS "public"."enum_radar_settings_payload_publish_mode";
  DROP TYPE IF EXISTS "public"."enum_radar_settings_scheduling_mode";
  `)
}
