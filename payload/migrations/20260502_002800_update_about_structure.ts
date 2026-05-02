import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "about" ADD COLUMN IF NOT EXISTS "intro_text" varchar;
    ALTER TABLE "about" DROP COLUMN IF EXISTS "content";

    CREATE TABLE IF NOT EXISTS "about_manifesto_sections" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" varchar NOT NULL,
      "content" jsonb NOT NULL,
      "variant" varchar DEFAULT 'red'
    );

    ALTER TABLE "about_manifesto_sections" ADD CONSTRAINT "about_manifesto_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX IF NOT EXISTS "about_manifesto_sections_order_idx" ON "about_manifesto_sections" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "about_manifesto_sections_parent_id_idx" ON "about_manifesto_sections" USING btree ("_parent_id");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "about_manifesto_sections" CASCADE;
    ALTER TABLE "about" ADD COLUMN IF NOT EXISTS "content" jsonb;
    ALTER TABLE "about" DROP COLUMN IF EXISTS "intro_text";
  `)
}
