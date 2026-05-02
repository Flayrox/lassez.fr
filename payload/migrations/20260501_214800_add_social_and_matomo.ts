import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "social_links_bluesky" varchar;
    ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "social_links_mastodon" varchar;
    ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "social_links_tiktok" varchar;
    ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "social_links_linkedin" varchar;
    ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "matomo_settings_matomo_id" varchar DEFAULT '1';
    ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "matomo_settings_matomo_url" varchar DEFAULT 'https://stats.lassez.fr/';
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "settings" DROP COLUMN IF EXISTS "social_links_bluesky";
    ALTER TABLE "settings" DROP COLUMN IF EXISTS "social_links_mastodon";
    ALTER TABLE "settings" DROP COLUMN IF EXISTS "social_links_tiktok";
    ALTER TABLE "settings" DROP COLUMN IF EXISTS "social_links_linkedin";
    ALTER TABLE "settings" DROP COLUMN IF EXISTS "matomo_settings_matomo_id";
    ALTER TABLE "settings" DROP COLUMN IF EXISTS "matomo_settings_matomo_url";
  `)
}
