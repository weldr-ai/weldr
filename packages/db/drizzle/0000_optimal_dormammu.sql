CREATE TYPE "public"."message_roles" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."http_methods" AS ENUM('get', 'post', 'put', 'patch', 'delete');--> statement-breakpoint
CREATE TYPE "public"."integration_category" AS ENUM('database');--> statement-breakpoint
CREATE TYPE "public"."integration_type" AS ENUM('postgres', 'mysql');--> statement-breakpoint
CREATE TYPE "public"."primitive_type" AS ENUM('function', 'endpoint');--> statement-breakpoint
CREATE TYPE "public"."package_type" AS ENUM('production', 'development');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
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
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "waitlist" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "conversation_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"role" "message_roles" NOT NULL,
	"content" text NOT NULL,
	"raw_content" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"conversation_id" text NOT NULL,
	"user_id" text
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "endpoint_definition_packages" (
	"package_id" text NOT NULL,
	"endpoint_definition_id" text NOT NULL,
	CONSTRAINT "endpoint_definition_packages_package_id_endpoint_definition_id_pk" PRIMARY KEY("package_id","endpoint_definition_id")
);
--> statement-breakpoint
CREATE TABLE "endpoint_definition_resources" (
	"endpoint_definition_id" text NOT NULL,
	"resource_id" text NOT NULL,
	"metadata" jsonb,
	CONSTRAINT "endpoint_definition_resources_endpoint_definition_id_resource_id_pk" PRIMARY KEY("endpoint_definition_id","resource_id")
);
--> statement-breakpoint
CREATE TABLE "endpoint_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"path" text NOT NULL,
	"method" "http_methods" NOT NULL,
	"code" text NOT NULL,
	"diff" text NOT NULL,
	"open_api_spec" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"endpoint_id" text NOT NULL,
	"previous_id" text,
	"user_id" text NOT NULL,
	"version_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "endpoints" (
	"id" text PRIMARY KEY NOT NULL,
	"position_x" integer DEFAULT 0,
	"position_y" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"conversation_id" text NOT NULL,
	"project_id" text NOT NULL,
	"current_definition_id" text
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "integration_type" NOT NULL,
	"version" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"environment_variables" text[] DEFAULT NULL,
	"category" "integration_category" DEFAULT NULL
);
--> statement-breakpoint
CREATE TABLE "func_definition_packages" (
	"func_definition_id" text NOT NULL,
	"package_id" text NOT NULL,
	CONSTRAINT "func_definition_packages_func_definition_id_package_id_pk" PRIMARY KEY("func_definition_id","package_id")
);
--> statement-breakpoint
CREATE TABLE "func_definition_resources" (
	"func_definition_id" text NOT NULL,
	"resource_id" text NOT NULL,
	"metadata" jsonb,
	CONSTRAINT "func_definition_resources_func_definition_id_resource_id_pk" PRIMARY KEY("func_definition_id","resource_id")
);
--> statement-breakpoint
CREATE TABLE "func_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"input_schema" jsonb,
	"output_schema" jsonb,
	"raw_description" jsonb NOT NULL,
	"behavior" jsonb NOT NULL,
	"errors" text,
	"docs" text NOT NULL,
	"code" text NOT NULL,
	"diff" text NOT NULL,
	"test_input" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"previous_id" text,
	"func_id" text NOT NULL,
	"user_id" text NOT NULL,
	"version_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funcs" (
	"id" text PRIMARY KEY NOT NULL,
	"position_x" integer DEFAULT 0,
	"position_y" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text,
	"conversation_id" text,
	"project_id" text,
	"integration_id" text,
	"current_definition_id" text
);
--> statement-breakpoint
CREATE TABLE "resource_environment_variables" (
	"map_to" text NOT NULL,
	"resource_id" text NOT NULL,
	"environment_variable_id" text NOT NULL,
	CONSTRAINT "resource_environment_variables_resource_id_environment_variable_id_pk" PRIMARY KEY("resource_id","environment_variable_id")
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_deployed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"project_id" text NOT NULL,
	"integration_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "resources_name_project_id_unique" UNIQUE("name","project_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
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
CREATE TABLE "environment_variables" (
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
CREATE TABLE "dependencies" (
	"dependent_type" "primitive_type" NOT NULL,
	"dependent_definition_id" text NOT NULL,
	"dependency_type" "primitive_type" NOT NULL,
	"dependency_definition_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dependencies_dependent_type_dependent_definition_id_dependency_type_dependency_definition_id_pk" PRIMARY KEY("dependent_type","dependent_definition_id","dependency_type","dependency_definition_id"),
	CONSTRAINT "no_self_dep" CHECK (dependent_id != dependency_id),
	CONSTRAINT "valid_dep_types" CHECK (
        -- Allow:
        -- 1. Function -> Function
        -- 2. Endpoint -> Function
        -- Prevent:
        -- 1. Function -> Endpoint
        -- 2. Endpoint -> Endpoint
        dependency_type = 'function' AND
        (dependent_type = 'function' OR dependent_type = 'endpoint')
      )
);
--> statement-breakpoint
CREATE TABLE "version_endpoint_definitions" (
	"version_id" text NOT NULL,
	"endpoint_definition_id" text NOT NULL,
	CONSTRAINT "version_endpoint_definitions_version_id_endpoint_definition_id_pk" PRIMARY KEY("version_id","endpoint_definition_id")
);
--> statement-breakpoint
CREATE TABLE "version_func_definitions" (
	"version_id" text NOT NULL,
	"func_definition_id" text NOT NULL,
	CONSTRAINT "version_func_definitions_version_id_func_definition_id_pk" PRIMARY KEY("version_id","func_definition_id")
);
--> statement-breakpoint
CREATE TABLE "version_packages" (
	"version_id" text NOT NULL,
	"package_id" text NOT NULL,
	CONSTRAINT "version_packages_version_id_package_id_pk" PRIMARY KEY("version_id","package_id")
);
--> statement-breakpoint
CREATE TABLE "versions" (
	"id" text PRIMARY KEY NOT NULL,
	"version_number" integer NOT NULL,
	"version_name" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"parent_version_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"message_id" text,
	"project_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "packages" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "package_type" NOT NULL,
	"name" text NOT NULL,
	"reason" text NOT NULL,
	"version" text,
	"project_id" text,
	CONSTRAINT "packages_project_id_name_unique" UNIQUE("project_id","name")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endpoint_definition_packages" ADD CONSTRAINT "endpoint_definition_packages_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endpoint_definition_packages" ADD CONSTRAINT "endpoint_definition_packages_endpoint_definition_id_endpoint_definitions_id_fk" FOREIGN KEY ("endpoint_definition_id") REFERENCES "public"."endpoint_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endpoint_definition_resources" ADD CONSTRAINT "endpoint_definition_resources_endpoint_definition_id_endpoint_definitions_id_fk" FOREIGN KEY ("endpoint_definition_id") REFERENCES "public"."endpoint_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endpoint_definition_resources" ADD CONSTRAINT "endpoint_definition_resources_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endpoint_definitions" ADD CONSTRAINT "endpoint_definitions_endpoint_id_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."endpoints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endpoint_definitions" ADD CONSTRAINT "endpoint_definitions_previous_id_endpoint_definitions_id_fk" FOREIGN KEY ("previous_id") REFERENCES "public"."endpoint_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endpoint_definitions" ADD CONSTRAINT "endpoint_definitions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endpoint_definitions" ADD CONSTRAINT "endpoint_definitions_version_id_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endpoints" ADD CONSTRAINT "endpoints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endpoints" ADD CONSTRAINT "endpoints_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endpoints" ADD CONSTRAINT "endpoints_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endpoints" ADD CONSTRAINT "endpoints_current_definition_id_endpoint_definitions_id_fk" FOREIGN KEY ("current_definition_id") REFERENCES "public"."endpoint_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "func_definition_packages" ADD CONSTRAINT "func_definition_packages_func_definition_id_func_definitions_id_fk" FOREIGN KEY ("func_definition_id") REFERENCES "public"."func_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "func_definition_packages" ADD CONSTRAINT "func_definition_packages_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "func_definition_resources" ADD CONSTRAINT "func_definition_resources_func_definition_id_func_definitions_id_fk" FOREIGN KEY ("func_definition_id") REFERENCES "public"."func_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "func_definition_resources" ADD CONSTRAINT "func_definition_resources_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "func_definitions" ADD CONSTRAINT "func_definitions_previous_id_func_definitions_id_fk" FOREIGN KEY ("previous_id") REFERENCES "public"."func_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "func_definitions" ADD CONSTRAINT "func_definitions_func_id_funcs_id_fk" FOREIGN KEY ("func_id") REFERENCES "public"."funcs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "func_definitions" ADD CONSTRAINT "func_definitions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "func_definitions" ADD CONSTRAINT "func_definitions_version_id_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funcs" ADD CONSTRAINT "funcs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funcs" ADD CONSTRAINT "funcs_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funcs" ADD CONSTRAINT "funcs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funcs" ADD CONSTRAINT "funcs_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funcs" ADD CONSTRAINT "funcs_current_definition_id_func_definitions_id_fk" FOREIGN KEY ("current_definition_id") REFERENCES "public"."func_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_environment_variables" ADD CONSTRAINT "resource_environment_variables_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_environment_variables" ADD CONSTRAINT "resource_environment_variables_environment_variable_id_environment_variables_id_fk" FOREIGN KEY ("environment_variable_id") REFERENCES "public"."environment_variables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environment_variables" ADD CONSTRAINT "environment_variables_secret_id_secrets_id_fk" FOREIGN KEY ("secret_id") REFERENCES "vault"."secrets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environment_variables" ADD CONSTRAINT "environment_variables_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environment_variables" ADD CONSTRAINT "environment_variables_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "version_endpoint_definitions" ADD CONSTRAINT "version_endpoint_definitions_version_id_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "version_endpoint_definitions" ADD CONSTRAINT "version_endpoint_definitions_endpoint_definition_id_endpoint_definitions_id_fk" FOREIGN KEY ("endpoint_definition_id") REFERENCES "public"."endpoint_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "version_func_definitions" ADD CONSTRAINT "version_func_definitions_version_id_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "version_func_definitions" ADD CONSTRAINT "version_func_definitions_func_definition_id_func_definitions_id_fk" FOREIGN KEY ("func_definition_id") REFERENCES "public"."func_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "version_packages" ADD CONSTRAINT "version_packages_version_id_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "version_packages" ADD CONSTRAINT "version_packages_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versions" ADD CONSTRAINT "versions_parent_version_id_versions_id_fk" FOREIGN KEY ("parent_version_id") REFERENCES "public"."versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versions" ADD CONSTRAINT "versions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versions" ADD CONSTRAINT "versions_message_id_conversation_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."conversation_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versions" ADD CONSTRAINT "versions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "packages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversation_messages_created_at_idx" ON "conversation_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "conversations_created_at_idx" ON "conversations" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_endpoint_in_version" ON "endpoint_definitions" USING btree ("path","method","version_id");--> statement-breakpoint
CREATE INDEX "endpoint_data_created_at_idx" ON "endpoint_definitions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "endpoints_created_at_idx" ON "endpoints" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_func_in_version" ON "func_definitions" USING btree ("name","version_id");--> statement-breakpoint
CREATE INDEX "func_data_created_at_idx" ON "func_definitions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "funcs_created_at_idx" ON "funcs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "resources_created_at_idx" ON "resources" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "projects_created_at_idx" ON "projects" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "dependencies_created_at_idx" ON "dependencies" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "versions_created_at_idx" ON "versions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "versions_version_number_idx" ON "versions" USING btree ("version_number");
