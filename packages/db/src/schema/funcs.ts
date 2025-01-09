import type { JsonSchema, RawContent } from "@integramind/shared/types";
import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { conversations } from "./conversations";
import { dependencies } from "./dependencies";
import { integrations } from "./integrations";
import { funcPackages } from "./packages";
import { projects } from "./projects";
import { funcResources } from "./resources";

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
    diff: text("diff"),
    testInput: jsonb("test_input").$type<unknown>(),
    positionX: integer("position_x").default(0),
    positionY: integer("position_y").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    isDeleted: boolean("is_deleted").default(false),
    isDeployed: boolean("is_deployed").default(false),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id").references(() => conversations.id),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    integrationId: text("integration_id").references(() => integrations.id, {
      onDelete: "cascade",
    }),
    parentId: text("parent_id").references((): AnyPgColumn => funcs.id),
  },
  (t) => ({
    uniqueNameInProject: uniqueIndex("unique_func_name_in_project").on(
      t.name,
      t.projectId,
    ),
    createdAtIdx: index("funcs_created_at_idx").on(t.createdAt),
  }),
);

export const funcRelations = relations(funcs, ({ one, many }) => ({
  project: one(projects, {
    fields: [funcs.projectId],
    references: [projects.id],
  }),
  conversation: one(conversations, {
    fields: [funcs.conversationId],
    references: [conversations.id],
  }),
  user: one(users, {
    fields: [funcs.userId],
    references: [users.id],
  }),
  integration: one(integrations, {
    fields: [funcs.integrationId],
    references: [integrations.id],
  }),
  endpointDependencies: many(dependencies, {
    relationName: "dependency_endpoint",
  }),
  funcDependencies: many(dependencies, {
    relationName: "dependency_func",
  }),
  funcDependents: many(dependencies, {
    relationName: "dependent_func",
  }),
  resources: many(funcResources),
  packages: many(funcPackages),
  parent: one(funcs, {
    fields: [funcs.parentId],
    references: [funcs.id],
  }),
}));
