ALTER TABLE "conversation_messages" RENAME COLUMN "message" TO "content";--> statement-breakpoint
ALTER TABLE "conversation_messages" RENAME COLUMN "raw_message" TO "raw_content";