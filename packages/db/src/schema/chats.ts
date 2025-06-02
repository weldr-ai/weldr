import { createId } from "@paralleldrive/cuid2";
import type {
  AssistantMessageRawContent,
  ToolMessageRawContent,
  UserMessageRawContent,
  VersionMessageRawContent,
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
import { projects } from "./projects";

export const messageRoles = pgEnum("message_roles", [
  "user",
  "assistant",
  "tool",
  "version",
]);

export const chats = pgTable(
  "chats",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => [index("chats_created_at_idx").on(t.createdAt)],
);

export const chatRelations = relations(chats, ({ one, many }) => ({
  messages: many(chatMessages),
  user: one(users, {
    fields: [chats.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [chats.projectId],
    references: [projects.id],
  }),
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
        | VersionMessageRawContent
      >()
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    chatId: text("chat_id")
      .references(() => chats.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [index("chat_messages_created_at_idx").on(t.createdAt)],
);

export const chatMessageRelations = relations(
  chatMessages,
  ({ one, many }) => ({
    chat: one(chats, {
      fields: [chatMessages.chatId],
      references: [chats.id],
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
  (t) => [index("attachments_created_at_idx").on(t.createdAt)],
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
