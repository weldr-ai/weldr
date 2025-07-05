import { nanoid } from "@weldr/shared/nanoid";
import type { Task } from "@weldr/shared/types";
import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
} from "drizzle-orm/pg-core";
import { chats } from "./chats";
import { declarations } from "./declarations";
import { versions } from "./versions";

export const taskStatus = pgEnum("task_status", [
  "pending",
  "in_progress",
  "completed",
]);

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey().$defaultFn(nanoid),
  status: taskStatus("status").notNull().default("pending"),
  data: jsonb("data").$type<Task>().notNull(),
  chatId: text("chat_id")
    .references(() => chats.id, { onDelete: "cascade" })
    .notNull(),
  versionId: text("version_id")
    .references(() => versions.id, { onDelete: "cascade" })
    .notNull(),
});

export const taskRelations = relations(tasks, ({ one, many }) => ({
  version: one(versions, {
    fields: [tasks.versionId],
    references: [versions.id],
  }),
  chat: one(chats, {
    fields: [tasks.chatId],
    references: [chats.id],
  }),
  dependencies: many(taskDependencies, {
    relationName: "taskDependencies",
  }),
  dependents: many(taskDependencies, {
    relationName: "taskDependents",
  }),
  declaration: one(declarations),
}));

export const taskDependencies = pgTable(
  "task_dependencies",
  {
    dependentId: text("dependent_id")
      .references(() => tasks.id, { onDelete: "cascade" })
      .notNull(),
    dependencyId: text("dependency_id")
      .references(() => tasks.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.dependentId, t.dependencyId] }),
    index("task_dependencies_dependent_id_idx").on(t.dependentId),
    index("task_dependencies_dependency_id_idx").on(t.dependencyId),
  ],
);

export const taskDependencyRelations = relations(
  taskDependencies,
  ({ one }) => ({
    dependent: one(tasks, {
      fields: [taskDependencies.dependentId],
      references: [tasks.id],
      relationName: "taskDependencies",
    }),
    dependency: one(tasks, {
      fields: [taskDependencies.dependencyId],
      references: [tasks.id],
      relationName: "taskDependents",
    }),
  }),
);
