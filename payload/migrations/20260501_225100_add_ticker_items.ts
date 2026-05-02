import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "settings_ticker_items" (
        "_order" integer NOT NULL,
        "_parent_id" integer NOT NULL,
        "id" varchar PRIMARY KEY NOT NULL,
        "text" varchar NOT NULL,
        "active" boolean DEFAULT true
    );

    ALTER TABLE "settings_ticker_items" ADD CONSTRAINT "settings_ticker_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."settings"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX IF NOT EXISTS "settings_ticker_items_order_idx" ON "settings_ticker_items" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "settings_ticker_items_parent_id_idx" ON "settings_ticker_items" USING btree ("_parent_id");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "settings_ticker_items" CASCADE;
  `)
}
