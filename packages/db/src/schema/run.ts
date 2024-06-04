import { createId } from "@paralleldrive/cuid2";
import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";

export const jobs = pgTable("jobs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name"),
  state: text("state").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  failedAt: timestamp("failed_at"),
  tasks: jsonb("tasks").notNull(),
  position: integer("position").notNull(),
  inputs: jsonb("inputs").notNull(),
  context: jsonb("context").notNull(),
  description: text("description"),
  parentId: text("parent_id"),
  taskCount: integer("task_count").notNull(),
  output: text("output_"),
  result: text("result"),
  error: text("error_"),
  defaults: jsonb("defaults"),
  webhooks: jsonb("webhooks"),
});

export const jobSchema = createSelectSchema(jobs);
