import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import type {
  FlowMetadata,
  InputSchema,
  OutputSchema,
} from "@integramind/shared/types";
import { users } from "./auth";
import { conversations } from "./conversations";
import { edges } from "./edges";
import { funcs } from "./funcs";
import { testRuns } from "./test-runs";
import { workspaces } from "./workspaces";

export const flowTypes = pgEnum("flow_types", [
  "utility",
  "workflow",
  "endpoint",
]);

export const flows = pgTable("flows", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  description: text("description"),
  type: flowTypes("type").notNull(),
  inputSchema: jsonb("input_schema").$type<InputSchema>(),
  outputSchema: jsonb("output_schema").$type<OutputSchema>(),
  metadata: jsonb("metadata").$type<FlowMetadata>().notNull(),
  code: text("code"),
  isUpdated: boolean("is_updated").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  inputConversationId: text("input_conversation_id").notNull(),
  outputConversationId: text("output_conversation_id").notNull(),
  workspaceId: text("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
  userId: text("user_id")
    .references(() => users.id, {
      onDelete: "set null",
    })
    .default(sql`NULL`),
});

export const flowsRelations = relations(flows, ({ many, one }) => ({
  funcs: many(funcs),
  edges: many(edges, { relationName: "flow" }),
  user: one(users, {
    fields: [flows.userId],
    references: [users.id],
  }),
  inputConversation: one(conversations, {
    fields: [flows.inputConversationId],
    references: [conversations.id],
  }),
  outputConversation: one(conversations, {
    fields: [flows.outputConversationId],
    references: [conversations.id],
  }),
  workspace: one(workspaces, {
    fields: [flows.workspaceId],
    references: [workspaces.id],
  }),
  testRuns: many(testRuns),
}));
