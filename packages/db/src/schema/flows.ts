import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import type { FlowMetadata, InputSchema } from "@specly/shared/types";
import { users } from "./auth";
import { conversations } from "./conversations";
import { edges } from "./edges";
import { primitives } from "./primitives";
import { workspaces } from "./workspaces";

export const flowTypes = pgEnum("flow_types", [
  "component",
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
  validationSchema: text("validation_schema"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  workspaceId: text("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
  createdBy: text("created_by")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  conversationId: text("conversation_id")
    .references(() => conversations.id, { onDelete: "cascade" })
    .notNull(),
});

export const flowsRelations = relations(flows, ({ many, one }) => ({
  primitives: many(primitives),
  edges: many(edges),
  user: one(users, {
    fields: [flows.createdBy],
    references: [users.id],
  }),
  conversation: one(conversations, {
    fields: [flows.conversationId],
    references: [conversations.id],
  }),
}));
