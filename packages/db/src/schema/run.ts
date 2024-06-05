import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";

export const nodes = pgTable(
  "nodes",
  {
    id: varchar("id", { length: 32 }).primaryKey().notNull(),
    name: varchar("name", { length: 64 }).notNull(),
    queue: varchar("queue", { length: 64 }).notNull(),
    startedAt: timestamp("started_at", { mode: "string" }).notNull(),
    lastHeartbeatAt: timestamp("last_heartbeat_at", {
      mode: "string",
    }).notNull(),
    cpuPercent: doublePrecision("cpu_percent").notNull(),
    status: varchar("status", { length: 10 }).notNull(),
    hostname: varchar("hostname", { length: 128 }).notNull(),
    taskCount: integer("task_count").notNull(),
    version: varchar("version_", { length: 32 }).notNull(),
  },
  (table) => {
    return {
      idxNodesHeartbeat: index("idx_nodes_heartbeat").on(table.lastHeartbeatAt),
    };
  },
);

export const jobs = pgTable(
  "jobs",
  {
    id: varchar("id", { length: 32 }).primaryKey().notNull(),
    name: varchar("name", { length: 256 }),
    state: varchar("state", { length: 10 }).notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    startedAt: timestamp("started_at", { mode: "string" }),
    completedAt: timestamp("completed_at", { mode: "string" }),
    failedAt: timestamp("failed_at", { mode: "string" }),
    tasks: jsonb("tasks").notNull(),
    position: integer("position").notNull(),
    inputs: jsonb("inputs").notNull(),
    context: jsonb("context").notNull(),
    description: text("description"),
    parentId: varchar("parent_id", { length: 32 }),
    taskCount: integer("task_count").notNull(),
    output: text("output_"),
    result: text("result"),
    error: text("error_"),
    defaults: jsonb("defaults"),
    webhooks: jsonb("webhooks"),
  },
  (table) => {
    return {
      idxJobsState: index("idx_jobs_state").on(table.state),
    };
  },
);

export const tasks = pgTable(
  "tasks",
  {
    id: varchar("id", { length: 32 }).primaryKey().notNull(),
    jobId: varchar("job_id", { length: 32 })
      .notNull()
      .references(() => jobs.id),
    position: integer("position").notNull(),
    name: varchar("name", { length: 256 }),
    state: varchar("state", { length: 10 }).notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    scheduledAt: timestamp("scheduled_at", { mode: "string" }),
    startedAt: timestamp("started_at", { mode: "string" }),
    completedAt: timestamp("completed_at", { mode: "string" }),
    failedAt: timestamp("failed_at", { mode: "string" }),
    cmd: text("cmd").array(),
    entrypoint: text("entrypoint").array(),
    runScript: text("run_script"),
    image: varchar("image", { length: 256 }),
    registry: jsonb("registry"),
    env: jsonb("env"),
    files: jsonb("files_"),
    queue: varchar("queue", { length: 256 }),
    error: text("error_"),
    preTasks: jsonb("pre_tasks"),
    postTasks: jsonb("post_tasks"),
    mounts: jsonb("mounts"),
    nodeId: varchar("node_id", { length: 32 }),
    retry: jsonb("retry"),
    limits: jsonb("limits"),
    timeout: varchar("timeout", { length: 8 }),
    result: text("result"),
    var: varchar("var", { length: 64 }),
    parallel: jsonb("parallel"),
    parentId: varchar("parent_id", { length: 32 }),
    each: jsonb("each_"),
    description: text("description"),
    subjob: jsonb("subjob"),
    networks: text("networks").array(),
    gpus: text("gpus"),
    if: text("if_"),
    tags: text("tags").array(),
  },
  (table) => {
    return {
      idxTasksState: index("idx_tasks_state").on(table.state),
      idxTasksJobId: index("idx_tasks_job_id").on(table.jobId),
    };
  },
);

export const tasksLogParts = pgTable(
  "tasks_log_parts",
  {
    id: varchar("id", { length: 32 }).primaryKey().notNull(),
    number: integer("number_").notNull(),
    taskId: varchar("task_id", { length: 32 })
      .notNull()
      .references(() => tasks.id),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    contents: text("contents").notNull(),
  },
  (table) => {
    return {
      idxTasksLogPartsTaskId: index("idx_tasks_log_parts_task_id").on(
        table.taskId,
      ),
      idxTasksLogPartsCreatedAt: index("idx_tasks_log_parts_created_at").on(
        table.createdAt,
      ),
    };
  },
);

export const jobSchema = createSelectSchema(jobs);
