ALTER TYPE "flow_types" ADD VALUE 'utilities';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "integration_env" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"integration_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "integration_utils" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"implementation" text NOT NULL,
	"docs" text NOT NULL,
	"integration_id" text NOT NULL,
	CONSTRAINT "integration_utils_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "integrations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"description" text NOT NULL,
	"dependencies" text[] DEFAULT ARRAY[]::text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "primitives" DROP CONSTRAINT "primitives_flow_id_name_unique";--> statement-breakpoint
ALTER TABLE "conversation_messages" DROP CONSTRAINT "conversation_messages_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "edges" DROP CONSTRAINT "edges_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "flows" DROP CONSTRAINT "flows_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "primitives" DROP CONSTRAINT "primitives_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "workspaces" DROP CONSTRAINT "workspaces_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "conversation_messages" ALTER COLUMN "created_by" SET DEFAULT NULL;--> statement-breakpoint
ALTER TABLE "conversation_messages" ALTER COLUMN "created_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "created_by" SET DEFAULT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "created_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "edges" ALTER COLUMN "created_by" SET DEFAULT NULL;--> statement-breakpoint
ALTER TABLE "edges" ALTER COLUMN "created_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "flows" ALTER COLUMN "created_by" SET DEFAULT NULL;--> statement-breakpoint
ALTER TABLE "flows" ALTER COLUMN "created_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "primitives" ALTER COLUMN "created_by" SET DEFAULT NULL;--> statement-breakpoint
ALTER TABLE "primitives" ALTER COLUMN "created_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "created_by" SET DEFAULT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "created_by" DROP NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integration_env" ADD CONSTRAINT "integration_env_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integration_utils" ADD CONSTRAINT "integration_utils_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "integration_env_name_idx" ON "integration_env" USING btree ("name","integration_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "integration_utils_name_idx" ON "integration_utils" USING btree ("name","integration_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "edges" ADD CONSTRAINT "edges_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "flows" ADD CONSTRAINT "flows_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "primitives" ADD CONSTRAINT "primitives_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "primitives" ADD CONSTRAINT "primitives_name_flow_id_unique" UNIQUE("name","flow_id");
