import type {
  AssistantMessageRawContent,
  UserMessageRawContent,
} from "@integramind/shared/types";
import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const messageRoles = pgEnum("message_roles", ["user", "assistant"]);

export const conversations = pgTable("conversations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
});

export const conversationRelations = relations(conversations, ({ many }) => ({
  messages: many(conversationMessages),
}));

export const conversationMessages = pgTable("conversation_messages", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  role: messageRoles("role").notNull(),
  content: text("content").notNull(),
  rawContent: jsonb("raw_content")
    .$type<UserMessageRawContent | AssistantMessageRawContent>()
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  conversationId: text("conversation_id")
    .references(() => conversations.id, { onDelete: "cascade" })
    .notNull(),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
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
