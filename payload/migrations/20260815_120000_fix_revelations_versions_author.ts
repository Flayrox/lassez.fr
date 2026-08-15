import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Rattrapage d'un drift préexistant : le champ `author` a été ajouté à la
 * collection revelations (table `revelations`) sans régénérer la table de
 * versions `_revelations_v`, qui n'avait donc pas la colonne
 * `version_author_id`. Cela cassait toute création via l'API REST
 * (POST /api/payload/revelations → 500).
 *
 * Reproduit le schéma de `_posts_v` (témoin correctement migré).
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "_revelations_v" ADD COLUMN IF NOT EXISTS "version_author_id" integer;

  CREATE INDEX IF NOT EXISTS "_revelations_v_version_version_author_idx" ON "_revelations_v" USING btree ("version_author_id");

  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = '_revelations_v_version_author_id_authors_id_fk'
    ) THEN
      ALTER TABLE "_revelations_v" ADD CONSTRAINT "_revelations_v_version_author_id_authors_id_fk"
        FOREIGN KEY ("version_author_id") REFERENCES "public"."authors"("id")
        ON DELETE set null ON UPDATE no action;
    END IF;
  END $$;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "_revelations_v" DROP CONSTRAINT IF EXISTS "_revelations_v_version_author_id_authors_id_fk";
  DROP INDEX IF EXISTS "_revelations_v_version_version_author_idx";
  ALTER TABLE "_revelations_v" DROP COLUMN IF EXISTS "version_author_id";
  `)
}
