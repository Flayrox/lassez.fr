import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Ajout de la clé API Gemini dans le global radar-settings (onglet
 * IA & Concurrence) — la clé était jusque-là uniquement dans le .env,
 * elle est désormais gérable depuis l'interface sécurisée de l'admin.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "radar_settings" ADD COLUMN IF NOT EXISTS "gemini_api_key" varchar;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "radar_settings" DROP COLUMN IF EXISTS "gemini_api_key";
  `)
}
