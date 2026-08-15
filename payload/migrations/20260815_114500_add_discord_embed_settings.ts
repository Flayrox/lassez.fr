import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Ajout des paramètres de personnalisation de l'embed Discord
 * (couleur + footer) dans le global radar-settings.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "radar_settings" ADD COLUMN IF NOT EXISTS "discord_embed_color" varchar DEFAULT '#DC2626';
  ALTER TABLE "radar_settings" ADD COLUMN IF NOT EXISTS "discord_footer_text" varchar DEFAULT 'Radar L''Assez • Investigation';
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "radar_settings" DROP COLUMN IF EXISTS "discord_embed_color";
  ALTER TABLE "radar_settings" DROP COLUMN IF EXISTS "discord_footer_text";
  `)
}
