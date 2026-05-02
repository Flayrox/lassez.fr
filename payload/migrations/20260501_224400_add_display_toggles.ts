import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "settings" ADD COLUMN "display_settings_flash_info_enabled" boolean DEFAULT true;
    ALTER TABLE "settings" ADD COLUMN "display_settings_show_header" boolean DEFAULT true;
    ALTER TABLE "settings" ADD COLUMN "display_settings_show_footer" boolean DEFAULT true;
    ALTER TABLE "settings_navigation" ADD COLUMN "enabled" boolean DEFAULT true;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "settings" DROP COLUMN "display_settings_flash_info_enabled";
    ALTER TABLE "settings" DROP COLUMN "display_settings_show_header";
    ALTER TABLE "settings" DROP COLUMN "display_settings_show_footer";
    ALTER TABLE "settings_navigation" DROP COLUMN "enabled";
  `)
}
