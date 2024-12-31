import type {
  AssistantMessageRawContent,
  UserMessageRawContent,
} from "@integramind/shared/types";
import { createId } from "@paralleldrive/cuid2";
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
    userIdIdx: index("conversations_user_id_idx").on(t.userId),
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
      .$type<UserMessageRawContent | AssistantMessageRawContent>()
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    conversationId: text("conversation_id")
      .references(() => conversations.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => ({
    userIdIdx: index("conversation_messages_user_id_idx").on(t.userId),
    conversationIdIdx: index("conversation_messages_conversation_id_idx").on(
      t.conversationId,
    ),
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
  }),
);
