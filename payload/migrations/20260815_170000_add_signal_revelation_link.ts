import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Lien bidirectionnel signal ↔ révélation.
 *
 * Le daemon publie chaque signal comme une révélation sur le site ; cette
 * migration matérialise la relation dans Payload :
 *   - revelations.source_signal_id  → signals.id  (d'où vient la révélation)
 *   - signals.revelation_id         → revelations.id (ce que le signal a produit)
 *
 * La table de versions _revelations_v reçoit aussi la colonne pour que les
 * brouillons/versions ne cassent pas la création REST.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "revelations" ADD COLUMN IF NOT EXISTS "source_signal_id" integer;
  ALTER TABLE "signals" ADD COLUMN IF NOT EXISTS "revelation_id" integer;
  ALTER TABLE "_revelations_v" ADD COLUMN IF NOT EXISTS "version_source_signal_id" integer;

  CREATE INDEX IF NOT EXISTS "revelations_source_signal_idx" ON "revelations" USING btree ("source_signal_id");
  CREATE INDEX IF NOT EXISTS "signals_revelation_idx" ON "signals" USING btree ("revelation_id");
  CREATE INDEX IF NOT EXISTS "_revelations_v_version_version_source_signal_idx" ON "_revelations_v" USING btree ("version_source_signal_id");

  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'revelations_source_signal_id_signals_id_fk') THEN
      ALTER TABLE "revelations" ADD CONSTRAINT "revelations_source_signal_id_signals_id_fk"
        FOREIGN KEY ("source_signal_id") REFERENCES "public"."signals"("id")
        ON DELETE set null ON UPDATE no action;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signals_revelation_id_revelations_id_fk') THEN
      ALTER TABLE "signals" ADD CONSTRAINT "signals_revelation_id_revelations_id_fk"
        FOREIGN KEY ("revelation_id") REFERENCES "public"."revelations"("id")
        ON DELETE set null ON UPDATE no action;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_revelations_v_version_source_signal_id_signals_id_fk') THEN
      ALTER TABLE "_revelations_v" ADD CONSTRAINT "_revelations_v_version_source_signal_id_signals_id_fk"
        FOREIGN KEY ("version_source_signal_id") REFERENCES "public"."signals"("id")
        ON DELETE set null ON UPDATE no action;
    END IF;
  END $$;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "revelations" DROP CONSTRAINT IF EXISTS "revelations_source_signal_id_signals_id_fk";
  ALTER TABLE "signals" DROP CONSTRAINT IF EXISTS "signals_revelation_id_revelations_id_fk";
  ALTER TABLE "_revelations_v" DROP CONSTRAINT IF EXISTS "_revelations_v_version_source_signal_id_signals_id_fk";
  DROP INDEX IF EXISTS "revelations_source_signal_idx";
  DROP INDEX IF EXISTS "signals_revelation_idx";
  DROP INDEX IF EXISTS "_revelations_v_version_version_source_signal_idx";
  ALTER TABLE "revelations" DROP COLUMN IF EXISTS "source_signal_id";
  ALTER TABLE "signals" DROP COLUMN IF EXISTS "revelation_id";
  ALTER TABLE "_revelations_v" DROP COLUMN IF EXISTS "version_source_signal_id";
  `)
}
