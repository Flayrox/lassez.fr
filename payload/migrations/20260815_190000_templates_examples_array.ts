import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Formats éditoriaux : les exemples étaient stockés dans un champ JSON brut
 * (`examples_json`, illisible dans l'admin) avec des retours à la ligne
 * double-échappés (`\n` littéraux au lieu de vrais sauts de ligne).
 *
 * Cette migration :
 *  1. crée la table array `taxonomy_templates_examples` (le champ natif
 *     Payload `examples` : une ligne éditable par exemple, +/− inline) ;
 *  2. copie les données de `examples_json` (jsonb array) vers la nouvelle
 *     table, en remplaçant les `\n` littéraux par de vrais retours à la ligne ;
 *  3. convertit `output_schema_json` de jsonb vers text (éditeur de code).
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TABLE IF NOT EXISTS "taxonomy_templates_examples" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "example" varchar
  );
  `)
  await db.execute(sql`
  ALTER TABLE "taxonomy_templates_examples" ADD CONSTRAINT "taxonomy_templates_examples_parent_id_fk"
    FOREIGN KEY ("_parent_id") REFERENCES "public"."taxonomy_templates"("id")
    ON DELETE cascade ON UPDATE no action;
  CREATE INDEX IF NOT EXISTS "taxonomy_templates_examples_order_idx"
    ON "taxonomy_templates_examples" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "taxonomy_templates_examples_parent_id_idx"
    ON "taxonomy_templates_examples" USING btree ("_parent_id");
  `)
  // Copie des exemples : chaque élément du jsonb array devient une ligne.
  // Le double échappement (\\n littéral = backslash + n) est corrigé en vrai
  // retour à la ligne (chr(92) = backslash, chr(10) = newline).
  await db.execute(sql`
  INSERT INTO "taxonomy_templates_examples" ("_order", "_parent_id", "id", "example")
  SELECT arr.ord - 1, t.id, md5(random()::text || t.id::text || arr.ord::text),
         replace(arr.value, chr(92) || 'n', chr(10))
  FROM "taxonomy_templates" t
  CROSS JOIN LATERAL jsonb_array_elements_text(t."examples_json") WITH ORDINALITY AS arr(value, ord)
  ON CONFLICT DO NOTHING;
  `)
  // Le champ output_schema_json passe de jsonb à text (éditeur de code).
  await db.execute(sql`
  ALTER TABLE "taxonomy_templates" ALTER COLUMN "output_schema_json" TYPE text
    USING "output_schema_json"::text;
  `)
  // La colonne jsonb d'origine n'est plus référencée par la config.
  await db.execute(sql`
  ALTER TABLE "taxonomy_templates" DROP COLUMN IF EXISTS "examples_json";
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP TABLE IF EXISTS "taxonomy_templates_examples" CASCADE;
  ALTER TABLE "taxonomy_templates" ALTER COLUMN "output_schema_json" TYPE jsonb
    USING to_jsonb("output_schema_json"::text);
  ALTER TABLE "taxonomy_templates" ADD COLUMN IF NOT EXISTS "examples_json" jsonb;
  `)
}
