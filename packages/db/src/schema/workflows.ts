import { nanoid } from "@weldr/shared/nanoid";
import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { versions } from "./versions";

export const workflowStatus = pgEnum("workflow_status", [
  "running",
  "completed",
  "failed",
  "suspended",
]);

export const workflowStepStatus = pgEnum("workflow_step_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "skipped",
]);

export const workflowRuns = pgTable(
  "workflow_runs",
  {
    id: text("id").primaryKey().$defaultFn(nanoid),
    versionId: text("version_id")
      .references(() => versions.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    status: workflowStatus("status").notNull().default("running"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("workflow_runs_version_id_idx").on(table.versionId),
    index("workflow_runs_status_idx").on(table.status),
    index("workflow_runs_started_at_idx").on(table.startedAt),
  ],
);

export const workflowStepExecutions = pgTable(
  "workflow_step_executions",
  {
    id: text("id").primaryKey().$defaultFn(nanoid),
    workflowRunId: text("workflow_run_id")
      .references(() => workflowRuns.id, { onDelete: "cascade" })
      .notNull(),
    stepId: text("step_id").notNull(),
    status: workflowStepStatus("status").notNull().default("pending"),
    output: jsonb("output"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("workflow_step_executions_run_step_idx").on(
      table.workflowRunId,
      table.stepId,
    ),
    index("workflow_step_executions_run_id_idx").on(table.workflowRunId),
    index("workflow_step_executions_status_idx").on(table.status),
  ],
);

export const workflowRunsRelations = relations(
  workflowRuns,
  ({ one, many }) => ({
    version: one(versions, {
      fields: [workflowRuns.versionId],
      references: [versions.id],
    }),
    stepExecutions: many(workflowStepExecutions),
  }),
);

export const workflowStepExecutionsRelations = relations(
  workflowStepExecutions,
  ({ one }) => ({
    workflowRun: one(workflowRuns, {
      fields: [workflowStepExecutions.workflowRunId],
      references: [workflowRuns.id],
    }),
  }),
);
