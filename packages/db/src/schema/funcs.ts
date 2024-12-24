import type {
  FuncResource,
  JsonSchema,
  NpmDependency,
  RawContent,
} from "@integramind/shared/types";
import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { conversations } from "./conversations";
import { funcInternalGraph } from "./func-internal-graph";
import { modules } from "./modules";
import { projects } from "./projects";
import { testRuns } from "./test-runs";

export const funcs = pgTable(
  "funcs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name"),
    inputSchema: jsonb("input_schema").$type<JsonSchema>(),
    outputSchema: jsonb("output_schema").$type<JsonSchema>(),
    rawDescription: jsonb("raw_description").$type<RawContent>(),
    behavior: jsonb("behavior").$type<RawContent>(),
    errors: text("errors"),
    docs: text("docs"),
    code: text("code"),
    npmDependencies: jsonb("npm_dependencies").$type<NpmDependency[]>(),
    resources: jsonb("resources").$type<FuncResource[]>(),
    testInput: jsonb("test_input").$type<unknown>(),
    positionX: integer("position_x").default(0),
    positionY: integer("position_y").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id").references(() => conversations.id),
    moduleId: text("module_id")
      .references(() => modules.id, { onDelete: "cascade" })
      .notNull(),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
  },
  (t) => ({
    uniqueName: uniqueIndex("unique_name").on(t.name, t.moduleId),
  }),
);

export const funcRelations = relations(funcs, ({ one, many }) => ({
  module: one(modules, {
    fields: [funcs.moduleId],
    references: [modules.id],
  }),
  project: one(projects, {
    fields: [funcs.projectId],
    references: [projects.id],
  }),
  conversation: one(conversations, {
    fields: [funcs.conversationId],
    references: [conversations.id],
  }),
  testRuns: many(testRuns),
  user: one(users, {
    fields: [funcs.userId],
    references: [users.id],
  }),
  internalGraph: one(funcInternalGraph),
}));
