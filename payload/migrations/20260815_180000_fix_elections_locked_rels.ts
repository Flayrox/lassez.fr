import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Correction de la migration « add_elections » : elle a créé la table
 * `elections` mais a oublié d'enregistrer la collection dans la table de
 * relations des documents verrouillés (`payload_locked_documents_rels`).
 *
 * Sans cette colonne, toute requête de verrouillage de document (locking
 * Payload, déclenchée à chaque écriture quand l'admin est ouvert) échoue avec
 * `column ...elections_id does not exist`, y compris l'endpoint custom
 * /radar/generate-image qui fait un update après la génération du visuel.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "elections_id" integer;
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_elections_idx"
    ON "payload_locked_documents_rels" USING btree ("elections_id");
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payload_locked_documents_rels_elections_fk') THEN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_elections_fk"
        FOREIGN KEY ("elections_id") REFERENCES "public"."elections"("id")
        ON DELETE cascade ON UPDATE no action;
    END IF;
  END $$;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_elections_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_elections_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "elections_id";
  `)
}
