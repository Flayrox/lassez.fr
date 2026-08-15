import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Ajout des réglages de diffusion sociale modulable dans le global
 * radar-settings : lien source dans les posts et limites de caractères
 * par plateforme (X, Bluesky, Mastodon).
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "radar_settings" ADD COLUMN IF NOT EXISTS "include_source_url" boolean DEFAULT true;
  ALTER TABLE "radar_settings" ADD COLUMN IF NOT EXISTS "x_max_length" integer DEFAULT 280;
  ALTER TABLE "radar_settings" ADD COLUMN IF NOT EXISTS "bluesky_max_length" integer DEFAULT 300;
  ALTER TABLE "radar_settings" ADD COLUMN IF NOT EXISTS "mastodon_max_length" integer DEFAULT 500;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "radar_settings" DROP COLUMN IF EXISTS "include_source_url";
  ALTER TABLE "radar_settings" DROP COLUMN IF EXISTS "x_max_length";
  ALTER TABLE "radar_settings" DROP COLUMN IF EXISTS "bluesky_max_length";
  ALTER TABLE "radar_settings" DROP COLUMN IF EXISTS "mastodon_max_length";
  `)
}
