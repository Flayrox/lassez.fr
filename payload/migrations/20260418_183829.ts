import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_revelations_zone_geo" AS ENUM('france', 'international');
  CREATE TYPE "public"."enum__revelations_v_version_zone_geo" AS ENUM('france', 'international');
  CREATE TABLE "revelations_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"tags_id" integer
  );
  
  CREATE TABLE "_revelations_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"tags_id" integer
  );
  
  ALTER TABLE "revelations" ADD COLUMN "zone_geo" "enum_revelations_zone_geo" DEFAULT 'france';
  ALTER TABLE "_revelations_v" ADD COLUMN "version_zone_geo" "enum__revelations_v_version_zone_geo" DEFAULT 'france';
  ALTER TABLE "revelations_rels" ADD CONSTRAINT "revelations_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."revelations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "revelations_rels" ADD CONSTRAINT "revelations_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_revelations_v_rels" ADD CONSTRAINT "_revelations_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_revelations_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_revelations_v_rels" ADD CONSTRAINT "_revelations_v_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "revelations_rels_order_idx" ON "revelations_rels" USING btree ("order");
  CREATE INDEX "revelations_rels_parent_idx" ON "revelations_rels" USING btree ("parent_id");
  CREATE INDEX "revelations_rels_path_idx" ON "revelations_rels" USING btree ("path");
  CREATE INDEX "revelations_rels_tags_id_idx" ON "revelations_rels" USING btree ("tags_id");
  CREATE INDEX "_revelations_v_rels_order_idx" ON "_revelations_v_rels" USING btree ("order");
  CREATE INDEX "_revelations_v_rels_parent_idx" ON "_revelations_v_rels" USING btree ("parent_id");
  CREATE INDEX "_revelations_v_rels_path_idx" ON "_revelations_v_rels" USING btree ("path");
  CREATE INDEX "_revelations_v_rels_tags_id_idx" ON "_revelations_v_rels" USING btree ("tags_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "revelations_rels" CASCADE;
  DROP TABLE "_revelations_v_rels" CASCADE;
  ALTER TABLE "revelations" DROP COLUMN "zone_geo";
  ALTER TABLE "_revelations_v" DROP COLUMN "version_zone_geo";
  DROP TYPE "public"."enum_revelations_zone_geo";
  DROP TYPE "public"."enum__revelations_v_version_zone_geo";`)
}
