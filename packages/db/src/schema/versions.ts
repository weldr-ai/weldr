import { nanoid } from "@weldr/shared/nanoid";
import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { chats } from "./chats";
import { declarations } from "./declarations";
import { projects } from "./projects";
import { workflowRuns } from "./workflows";

export const versionStatus = pgEnum("version_status", [
  "pending",
  "in_progress",
  "completed",
  "failed",
]);

export const versions = pgTable(
  "versions",
  {
    id: text("id").primaryKey().$defaultFn(nanoid),
    number: integer("number").notNull().default(1),
    message: text("message"),
    description: text("description"),
    status: versionStatus("status").default("pending").notNull(),
    acceptanceCriteria: jsonb("acceptance_criteria").$type<string[]>(),
    commitHash: text("commit_hash"),
    chatId: text("chat_id")
      .references(() => chats.id, { onDelete: "cascade" })
      .notNull(),
    changedFiles: jsonb("changed_files")
      .$type<string[]>()
      .default([])
      .notNull(),
    activatedAt: timestamp("activated_at").defaultNow(),
    parentVersionId: text("parent_version_id").references(
      (): AnyPgColumn => versions.id,
      { onDelete: "cascade" },
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date()),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
  },
  (table) => [
    uniqueIndex("active_version_idx")
      .on(table.projectId, table.activatedAt)
      .where(sql`(activated_at IS NOT NULL)`),
    uniqueIndex("version_number_unique_idx").on(table.projectId, table.number),
    index("versions_created_at_idx").on(table.createdAt),
    index("versions_chat_id_idx").on(table.chatId),
  ],
);

export const versionsRelations = relations(versions, ({ one, many }) => ({
  parent: one(versions, {
    fields: [versions.parentVersionId],
    references: [versions.id],
    relationName: "version_parent",
  }),
  children: many(versions, {
    relationName: "version_children",
  }),
  chat: one(chats, {
    fields: [versions.chatId],
    references: [chats.id],
  }),
  project: one(projects, {
    fields: [versions.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [versions.userId],
    references: [users.id],
  }),
  workflowRun: one(workflowRuns, {
    fields: [versions.id],
    references: [workflowRuns.versionId],
  }),
  declarations: many(versionDeclarations),
}));

export const versionDeclarations = pgTable(
  "version_declarations",
  {
    versionId: text("version_id")
      .references(() => versions.id, { onDelete: "cascade" })
      .notNull(),
    declarationId: text("declaration_id")
      .references(() => declarations.id, { onDelete: "cascade" })
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.versionId, table.declarationId] })],
);

export const versionDeclarationsRelations = relations(
  versionDeclarations,
  ({ one }) => ({
    declaration: one(declarations, {
      fields: [versionDeclarations.declarationId],
      references: [declarations.id],
    }),
    version: one(versions, {
      fields: [versionDeclarations.versionId],
      references: [versions.id],
    }),
  }),
);
