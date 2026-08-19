import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Ajout des réglages de journalisation du global radar-settings (onglet
 * « Logs ») : niveau minimal, rétention, miroir Payload et nœuds suivis.
 * Ces champs étaient présents dans la config mais sans migration —
 * /admin/globals/radar-settings échouait avec « column log_level does not exist ».
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  DO $$ BEGIN
    CREATE TYPE "public"."enum_radar_settings_log_level" AS ENUM('DEBUG', 'INFO', 'WARN', 'ERROR');
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  `)
  await db.execute(sql`
  ALTER TABLE "radar_settings" ADD COLUMN IF NOT EXISTS "log_level" "enum_radar_settings_log_level" DEFAULT 'INFO';
  ALTER TABLE "radar_settings" ADD COLUMN IF NOT EXISTS "log_retention_days" numeric DEFAULT 14;
  ALTER TABLE "radar_settings" ADD COLUMN IF NOT EXISTS "log_mirror_payload" boolean DEFAULT true;
  ALTER TABLE "radar_settings" ADD COLUMN IF NOT EXISTS "log_mirror_nodes" varchar DEFAULT '[]';
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "radar_settings" DROP COLUMN IF EXISTS "log_level";
  ALTER TABLE "radar_settings" DROP COLUMN IF EXISTS "log_retention_days";
  ALTER TABLE "radar_settings" DROP COLUMN IF EXISTS "log_mirror_payload";
  ALTER TABLE "radar_settings" DROP COLUMN IF EXISTS "log_mirror_nodes";
  DROP TYPE IF EXISTS "public"."enum_radar_settings_log_level";
  `)
}
