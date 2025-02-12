import { createId } from "@paralleldrive/cuid2";
import type {
  AssistantMessageRawContent,
  ToolMessageRawContent,
  UserMessageRawContent,
} from "@weldr/shared/types";
import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { versions } from "./versions";

export const messageRoles = pgEnum("message_roles", [
  "user",
  "assistant",
  "tool",
]);

export const chats = pgTable(
  "chats",
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
    createdAtIdx: index("chats_created_at_idx").on(t.createdAt),
  }),
);

export const chatRelations = relations(chats, ({ many }) => ({
  messages: many(chatMessages),
}));

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    role: messageRoles("role").notNull(),
    content: text("content"),
    rawContent: jsonb("raw_content")
      .$type<
        | UserMessageRawContent
        | AssistantMessageRawContent
        | ToolMessageRawContent
      >()
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    chatId: text("chat_id")
      .references(() => chats.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => ({
    createdAtIdx: index("chat_messages_created_at_idx").on(t.createdAt),
  }),
);

export const chatMessageRelations = relations(
  chatMessages,
  ({ one, many }) => ({
    chat: one(chats, {
      fields: [chatMessages.chatId],
      references: [chats.id],
    }),
    version: one(versions, {
      fields: [chatMessages.id],
      references: [versions.messageId],
    }),
    attachments: many(attachments),
    user: one(users, {
      fields: [chatMessages.userId],
      references: [users.id],
    }),
  }),
);

export const attachments = pgTable(
  "attachments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name").notNull(),
    key: text("key").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    messageId: text("message_id")
      .references(() => chatMessages.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => ({
    createdAtIdx: index("attachments_created_at_idx").on(t.createdAt),
  }),
);

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  user: one(users, {
    fields: [attachments.userId],
    references: [users.id],
  }),
  message: one(chatMessages, {
    fields: [attachments.messageId],
    references: [chatMessages.id],
  }),
}));
