CREATE TYPE "public"."test_run_status" AS ENUM('success', 'error');--> statement-breakpoint
ALTER TABLE "test_runs" ADD COLUMN "status" "test_run_status" DEFAULT 'success';--> statement-breakpoint
ALTER TABLE "test_runs" DROP COLUMN IF EXISTS "updated_at";