import { relations } from "drizzle-orm";
import {
  type AnyPgColumn,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  vector,
} from "drizzle-orm/pg-core";

import { nanoid } from "@weldr/shared/nanoid";
import type { DeclarationMetadata } from "@weldr/shared/types/declarations";

import { users } from "./auth";
import { dependencies } from "./dependencies";
import { nodes } from "./nodes";
import { projects } from "./projects";
import { tasks } from "./tasks";
import { versionDeclarations } from "./versions";

export const declarations = pgTable(
  "declarations",
  {
    id: text("id").primaryKey().$defaultFn(nanoid),
    version: text("version").default("v1").notNull(),
    uri: text("uri"),
    path: text("path"),
    progress: text("progress")
      .$type<"pending" | "in_progress" | "enriching" | "completed">()
      .notNull(),
    metadata: jsonb("metadata").$type<DeclarationMetadata>(),
    embedding: vector("embedding", { dimensions: 1536 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    previousId: text("previous_id").references(
      (): AnyPgColumn => declarations.id,
    ),
    taskId: text("task_id").references(() => tasks.id, {
      onDelete: "cascade",
    }),
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    nodeId: text("node_id").references(() => nodes.id, {
      onDelete: "set null",
    }),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
  },
  (table) => [
    index("declaration_created_at_idx").on(table.createdAt),
    index("embeddingIndex").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
    unique("declaration_uri_unique").on(table.uri),
  ],
);

export const declarationsRelations = relations(
  declarations,
  ({ one, many }) => ({
    node: one(nodes, {
      fields: [declarations.nodeId],
      references: [nodes.id],
    }),
    previous: many(declarations),
    project: one(projects, {
      fields: [declarations.projectId],
      references: [projects.id],
    }),
    task: one(tasks, {
      fields: [declarations.taskId],
      references: [tasks.id],
    }),
    user: one(users, {
      fields: [declarations.userId],
      references: [users.id],
    }),
    dependencies: many(dependencies, {
      relationName: "dependency_declaration",
    }),
    dependents: many(dependencies, {
      relationName: "dependent_declaration",
    }),
    versions: many(versionDeclarations),
  }),
);
