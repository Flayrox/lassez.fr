import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Ajout du groupe `communication` au global `settings` (ex-table SQLite
 * legacy `radar_settings`) : mode maintenance + popup d'information.
 * Les valeurs existantes de l'ancienne colonne `maintenance_mode` sont
 * reprises dans `communication_maintenance_mode` si elles ne sont pas vides.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "communication_maintenance_mode" boolean DEFAULT false;
  ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "communication_maintenance_message" varchar;
  ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "communication_popup_enabled" boolean DEFAULT false;
  ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "communication_popup_title" varchar;
  ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "communication_popup_text" varchar;
  ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "communication_popup_link_url" varchar;
  ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "communication_popup_link_label" varchar;
  `)

  // Backfill : reprendre l'ancien mode maintenance (champ top-level déplacé
  // dans le groupe) pour ne pas perdre l'état actuel.
  await db.execute(sql`
  UPDATE "settings"
  SET "communication_maintenance_mode" = "maintenance_mode"
  WHERE "communication_maintenance_mode" IS NULL
    AND "maintenance_mode" IS NOT NULL;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "settings" DROP COLUMN IF EXISTS "communication_maintenance_mode";
  ALTER TABLE "settings" DROP COLUMN IF EXISTS "communication_maintenance_message";
  ALTER TABLE "settings" DROP COLUMN IF EXISTS "communication_popup_enabled";
  ALTER TABLE "settings" DROP COLUMN IF EXISTS "communication_popup_title";
  ALTER TABLE "settings" DROP COLUMN IF EXISTS "communication_popup_text";
  ALTER TABLE "settings" DROP COLUMN IF EXISTS "communication_popup_link_url";
  ALTER TABLE "settings" DROP COLUMN IF EXISTS "communication_popup_link_label";
  `)
}
