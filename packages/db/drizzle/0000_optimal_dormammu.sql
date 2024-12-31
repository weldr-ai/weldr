CREATE TYPE "public"."message_roles" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."http_methods" AS ENUM('get', 'post', 'put', 'patch', 'delete');--> statement-breakpoint
CREATE TYPE "public"."integration_category" AS ENUM('database');--> statement-breakpoint
CREATE TYPE "public"."integration_type" AS ENUM('postgres', 'mysql');--> statement-breakpoint
CREATE TYPE "public"."dependent_type" AS ENUM('function', 'endpoint');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"expires_at" timestamp,
	"password" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "waitlist" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversation_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"role" "message_roles" NOT NULL,
	"content" text NOT NULL,
	"raw_content" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"conversation_id" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "endpoints" (
	"id" text PRIMARY KEY NOT NULL,
	"path" text,
	"method" "http_methods",
	"summary" text,
	"code" text,
	"open_api_spec" jsonb,
	"resources" jsonb,
	"packages" jsonb,
	"position_x" integer DEFAULT 0,
	"position_y" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"conversation_id" text NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text NOT NULL,
	CONSTRAINT "endpoints_project_id_path_method_unique" UNIQUE("project_id","path","method")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "integrations" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "integration_type" NOT NULL,
	"version" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"environment_variables" text[] DEFAULT NULL,
	"category" "integration_category" DEFAULT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "funcs" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"input_schema" jsonb,
	"output_schema" jsonb,
	"raw_description" jsonb,
	"behavior" jsonb,
	"errors" text,
	"docs" text,
	"code" text,
	"packages" jsonb,
	"resources" jsonb,
	"test_input" jsonb,
	"position_x" integer DEFAULT 0,
	"position_y" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text,
	"conversation_id" text,
	"project_id" text,
	"integration_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resource_environment_variables" (
	"map_to" text NOT NULL,
	"resource_id" text NOT NULL,
	"environment_variable_id" text NOT NULL,
	CONSTRAINT "resource_environment_variables_resource_id_environment_variable_id_pk" PRIMARY KEY("resource_id","environment_variable_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resources" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"project_id" text NOT NULL,
	"integration_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "resources_name_project_id_unique" UNIQUE("name","project_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"subdomain" text NOT NULL,
	"description" text,
	"engine_machine_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "projects_subdomain_unique" UNIQUE("subdomain")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "environment_variables" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"secret_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "unique_key" UNIQUE("project_id","key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "test_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"input" jsonb DEFAULT NULL,
	"stdout" text DEFAULT NULL,
	"stderr" text DEFAULT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"func_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dependencies" (
	"dependent_type" "dependent_type" NOT NULL,
	"dependent_id" text NOT NULL,
	"dependency_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "endpoints" ADD CONSTRAINT "endpoints_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "endpoints" ADD CONSTRAINT "endpoints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "endpoints" ADD CONSTRAINT "endpoints_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "funcs" ADD CONSTRAINT "funcs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "funcs" ADD CONSTRAINT "funcs_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "funcs" ADD CONSTRAINT "funcs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "funcs" ADD CONSTRAINT "funcs_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_environment_variables" ADD CONSTRAINT "resource_environment_variables_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_environment_variables" ADD CONSTRAINT "resource_environment_variables_environment_variable_id_environment_variables_id_fk" FOREIGN KEY ("environment_variable_id") REFERENCES "public"."environment_variables"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resources" ADD CONSTRAINT "resources_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resources" ADD CONSTRAINT "resources_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resources" ADD CONSTRAINT "resources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "environment_variables" ADD CONSTRAINT "environment_variables_secret_id_secrets_id_fk" FOREIGN KEY ("secret_id") REFERENCES "vault"."secrets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "environment_variables" ADD CONSTRAINT "environment_variables_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "environment_variables" ADD CONSTRAINT "environment_variables_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_func_id_funcs_id_fk" FOREIGN KEY ("func_id") REFERENCES "public"."funcs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dependencies" ADD CONSTRAINT "dependencies_dependency_id_funcs_id_fk" FOREIGN KEY ("dependency_id") REFERENCES "public"."funcs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_name" ON "funcs" USING btree ("name","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_dependency" ON "dependencies" USING btree ("dependent_type","dependent_id","dependency_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "func_idx" ON "dependencies" USING btree ("dependent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dependency_idx" ON "dependencies" USING btree ("dependency_id");
