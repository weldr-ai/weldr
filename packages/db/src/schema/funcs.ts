import type {
  JsonSchema,
  Package,
  RawContent,
  RequirementResource,
} from "@integramind/shared/types";
import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import {
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
import { integrations } from "./integrations";
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
    packages: jsonb("packages").$type<Package[]>(),
    resources: jsonb("resources").$type<RequirementResource[]>(),
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
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    integrationId: text("integration_id").references(() => integrations.id, {
      onDelete: "cascade",
    }),
  },
  (t) => ({
    uniqueName: uniqueIndex("unique_name").on(t.name, t.projectId),
    projectIdIdx: index("funcs_project_id_idx").on(t.projectId),
    userIdIdx: index("funcs_user_id_idx").on(t.userId),
    conversationIdIdx: index("funcs_conversation_id_idx").on(t.conversationId),
    integrationIdIdx: index("funcs_integration_id_idx").on(t.integrationId),
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
  testRuns: many(testRuns),
  user: one(users, {
    fields: [funcs.userId],
    references: [users.id],
  }),
  integration: one(integrations, {
    fields: [funcs.integrationId],
    references: [integrations.id],
  }),
}));
