import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "revelations" ADD COLUMN "slug" varchar;
    ALTER TABLE "_revelations_v" ADD COLUMN "version_slug" varchar;
    ALTER TABLE "settings" ADD COLUMN "seo_gemini_model" varchar DEFAULT 'gemini-3.1-pro-preview';
    
    -- Populate slugs for existing revelations using a simple slugify logic
    UPDATE "revelations" 
    SET "slug" = lower(regexp_replace("titre", '[^a-zA-Z0-9]+', '-', 'g')) 
    WHERE "slug" IS NULL;

    -- Handle potential trailing/leading dashes from the simple regex
    UPDATE "revelations"
    SET "slug" = trim(both '-' from "slug")
    WHERE "slug" LIKE '-%' OR "slug" LIKE '%-';

    -- If slug is still empty (e.g. only special chars), use id
    UPDATE "revelations"
    SET "slug" = 'revelation-' || "id"::text
    WHERE "slug" IS NULL OR "slug" = '';

    -- Now we can add the unique index
    CREATE UNIQUE INDEX "revelations_slug_idx" ON "revelations" USING btree ("slug");
    CREATE INDEX "_revelations_v_version_version_slug_idx" ON "_revelations_v" USING btree ("version_slug");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "revelations_slug_idx";
    DROP INDEX IF EXISTS "_revelations_v_version_version_slug_idx";
    ALTER TABLE "revelations" DROP COLUMN IF EXISTS "slug";
    ALTER TABLE "_revelations_v" DROP COLUMN IF EXISTS "version_slug";
    ALTER TABLE "settings" DROP COLUMN IF EXISTS "seo_gemini_model";
  `)
}
