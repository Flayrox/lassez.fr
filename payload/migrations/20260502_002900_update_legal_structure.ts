import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "legal_sections" ADD COLUMN IF NOT EXISTS "highlight_box" jsonb;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "legal_sections" DROP COLUMN IF EXISTS "highlight_box";
  `)
}
