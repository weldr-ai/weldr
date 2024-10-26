import { createId } from "@paralleldrive/cuid2";
import type { RawDescription } from "@specly/shared/types";
import { relations, sql } from "drizzle-orm";
import { jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { flows } from "./flows";
import { primitives } from "./primitives";

export const roles = pgEnum("roles", ["user", "assistant"]);

export const conversations = pgTable("conversations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  createdBy: text("created_by")
    .references(() => users.id, {
      onDelete: "set null",
    })
    .default(sql`NULL`),
  primitiveId: text("primitive_id").references(() => primitives.id, {
    onDelete: "cascade",
  }),
  flowId: text("flow_id").references(() => flows.id, { onDelete: "cascade" }),
});

export const conversationRelations = relations(
  conversations,
  ({ one, many }) => ({
    messages: many(conversationMessages),
    primitive: one(primitives, {
      fields: [conversations.primitiveId],
      references: [primitives.id],
    }),
    flow: one(flows, {
      fields: [conversations.flowId],
      references: [flows.id],
    }),
  }),
);

export const conversationMessages = pgTable("conversation_messages", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  role: roles("role").notNull(),
  content: text("content").notNull(),
  rawContent: jsonb("raw_content").$type<RawDescription[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  conversationId: text("conversation_id")
    .references(() => conversations.id, { onDelete: "cascade" })
    .notNull(),
  createdBy: text("created_by")
    .references(() => users.id, {
      onDelete: "set null",
    })
    .default(sql`NULL`),
});

export const conversationMessageRelations = relations(
  conversationMessages,
  ({ one }) => ({
    conversation: one(conversations, {
      fields: [conversationMessages.conversationId],
      references: [conversations.id],
    }),
  }),
);
