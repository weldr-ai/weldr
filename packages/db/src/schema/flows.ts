import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import { jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import type {
  FlowMetadata,
  InputSchema,
  OutputSchema,
} from "@integramind/shared/types";
import { users } from "./auth";
import { conversations } from "./conversations";
import { edges } from "./edges";
import { primitives } from "./primitives";
import { workspaces } from "./workspaces";

export const flowTypes = pgEnum("flow_types", [
  "utilities",
  "task",
  "endpoint",
]);

export const flows = pgTable("flows", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  description: text("description"),
  type: flowTypes("type").notNull(),
  metadata: jsonb("metadata").$type<FlowMetadata>().notNull(),
  inputSchema: jsonb("input_schema").$type<InputSchema>(),
  outputSchema: jsonb("output_schema").$type<OutputSchema>(),
  validationSchema: text("validation_schema"),
  inputConversationId: text("input_conversation_id")
    .references(() => conversations.id, { onDelete: "cascade" })
    .notNull(),
  outputConversationId: text("output_conversation_id")
    .references(() => conversations.id, { onDelete: "cascade" })
    .notNull(),
  code: text("code"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  workspaceId: text("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
  createdBy: text("created_by")
    .references(() => users.id, {
      onDelete: "set null",
    })
    .default(sql`NULL`),
});

export const flowsRelations = relations(flows, ({ many, one }) => ({
  primitives: many(primitives),
  edges: many(edges),
  user: one(users, {
    fields: [flows.createdBy],
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
}));
