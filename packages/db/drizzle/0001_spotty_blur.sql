ALTER TABLE "primitives" ADD COLUMN "parent_id" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "primitives" ADD CONSTRAINT "primitives_parent_id_primitives_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."primitives"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
