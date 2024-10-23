ALTER TABLE "flows" DROP CONSTRAINT "flows_conversation_id_conversations_id_fk";
--> statement-breakpoint
ALTER TABLE "primitives" DROP CONSTRAINT "primitives_parent_id_primitives_id_fk";
--> statement-breakpoint
ALTER TABLE "primitives" DROP CONSTRAINT "primitives_conversation_id_conversations_id_fk";
--> statement-breakpoint
ALTER TABLE "primitives" ALTER COLUMN "metadata" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "primitive_id" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "flow_id" text;--> statement-breakpoint
ALTER TABLE "primitives" ADD COLUMN "input_schema" jsonb;--> statement-breakpoint
ALTER TABLE "primitives" ADD COLUMN "output_schema" jsonb;--> statement-breakpoint
ALTER TABLE "primitives" ADD COLUMN "raw_description" jsonb;--> statement-breakpoint
ALTER TABLE "primitives" ADD COLUMN "generated_code" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_primitive_id_primitives_id_fk" FOREIGN KEY ("primitive_id") REFERENCES "public"."primitives"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_flow_id_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."flows"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "flows" DROP COLUMN IF EXISTS "conversation_id";--> statement-breakpoint
ALTER TABLE "primitives" DROP COLUMN IF EXISTS "parent_id";--> statement-breakpoint
ALTER TABLE "primitives" DROP COLUMN IF EXISTS "conversation_id";