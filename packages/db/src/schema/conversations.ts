import { createId } from "@paralleldrive/cuid2";
import type {
  AssistantMessageRawContent,
  TestExecutionMessageRawContent,
  UserMessageRawContent,
} from "@weldr/shared/types";
import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { versions } from "./versions";

export const messageRoles = pgEnum("message_roles", ["user", "assistant"]);

export const conversations = pgTable(
  "conversations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => ({
    createdAtIdx: index("conversations_created_at_idx").on(t.createdAt),
  }),
);

export const conversationRelations = relations(conversations, ({ many }) => ({
  messages: many(conversationMessages),
}));

export const conversationMessages = pgTable(
  "conversation_messages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    role: messageRoles("role").notNull(),
    content: text("content").notNull(),
    rawContent: jsonb("raw_content")
      .$type<
        | UserMessageRawContent
        | AssistantMessageRawContent
        | TestExecutionMessageRawContent
      >()
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    conversationId: text("conversation_id")
      .references(() => conversations.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => ({
    createdAtIdx: index("conversation_messages_created_at_idx").on(t.createdAt),
  }),
);

export const conversationMessageRelations = relations(
  conversationMessages,
  ({ one }) => ({
    conversation: one(conversations, {
      fields: [conversationMessages.conversationId],
      references: [conversations.id],
    }),
    version: one(versions, {
      fields: [conversationMessages.id],
      references: [versions.messageId],
    }),
  }),
);
