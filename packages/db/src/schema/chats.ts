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

import { nanoid } from "@weldr/shared/nanoid";
import type {
  AiMessageMetadata,
  ChatMessageContent,
} from "@weldr/shared/types";
import { users } from "./auth";
import { projects } from "./projects";
import { versions } from "./versions";

export const messageRoles = pgEnum("message_roles", [
  "user",
  "assistant",
  "tool",
]);

export const messageVisibility = pgEnum("message_visibility", [
  "public",
  "internal",
]);

export const chats = pgTable(
  "chats",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
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
  version: one(versions),
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
      .$defaultFn(() => nanoid()),
    visibility: messageVisibility("visibility").notNull().default("public"),
    role: messageRoles("role").notNull().default("assistant"),
    content: jsonb("content").$type<ChatMessageContent>().notNull(),
    metadata: jsonb("metadata").$type<AiMessageMetadata>(),
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
    id: text("id").primaryKey().$defaultFn(nanoid),
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
