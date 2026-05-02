import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_settings_navigation_link_type" AS ENUM('custom', 'category');

    CREATE TABLE IF NOT EXISTS "settings_navigation" (
        "_order" integer NOT NULL,
        "_parent_id" integer NOT NULL,
        "id" varchar PRIMARY KEY NOT NULL,
        "label" varchar NOT NULL,
        "badge" varchar,
        "link_type" "enum_settings_navigation_link_type" DEFAULT 'custom',
        "custom_url" varchar,
        "category_id" integer
    );

    ALTER TABLE "settings_navigation" ADD CONSTRAINT "settings_navigation_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."settings"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "settings_navigation" ADD CONSTRAINT "settings_navigation_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;

    CREATE INDEX IF NOT EXISTS "settings_navigation_order_idx" ON "settings_navigation" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "settings_navigation_parent_id_idx" ON "settings_navigation" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "settings_navigation_category_id_idx" ON "settings_navigation" USING btree ("category_id");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "settings_navigation" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_settings_navigation_link_type";
  `)
}
