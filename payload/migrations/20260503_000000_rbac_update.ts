import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Authors roles (join table for hasMany select)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "authors_roles" (
      "id" serial PRIMARY KEY,
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL REFERENCES "authors"("id") ON DELETE CASCADE,
      "value" text NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "authors_roles_order_idx" ON "authors_roles" ("order");
    CREATE INDEX IF NOT EXISTS "authors_roles_parent_id_idx" ON "authors_roles" ("parent_id");
  `)

  // Revelations updates
  await db.execute(sql`
    ALTER TABLE "revelations" ADD COLUMN IF NOT EXISTS "slug" text;
    ALTER TABLE "revelations" ADD COLUMN IF NOT EXISTS "author_id" integer;
    ALTER TABLE "revelations" ADD COLUMN IF NOT EXISTS "zone_geo" text DEFAULT 'france';
    CREATE UNIQUE INDEX IF NOT EXISTS "revelations_slug_idx" ON "revelations" ("slug");
  `)

  // Lessons updates
  await db.execute(sql`
    ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "author_id" integer;
  `)
  
  // Add foreign keys if they don't exist
  try {
    await db.execute(sql`
      ALTER TABLE "revelations" ADD CONSTRAINT "revelations_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "authors"("id") ON DELETE SET NULL;
    `)
  } catch (e) {}

  try {
    await db.execute(sql`
      ALTER TABLE "lessons" ADD CONSTRAINT "lessons_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "authors"("id") ON DELETE SET NULL;
    `)
  } catch (e) {}
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "authors_roles";
    ALTER TABLE "revelations" DROP COLUMN IF EXISTS "slug";
    ALTER TABLE "revelations" DROP COLUMN IF EXISTS "author_id";
    ALTER TABLE "revelations" DROP COLUMN IF EXISTS "zone_geo";
    ALTER TABLE "lessons" DROP COLUMN IF EXISTS "author_id";
  `)
}
