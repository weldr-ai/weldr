import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { declarations } from "./declarations";
import { projects } from "./projects";

export const files = pgTable(
  "files",
  {
    id: text().primaryKey().notNull(),
    name: text().notNull(),
    path: text().notNull(),
    contentType: text("content_type"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    projectId: text("project_id").notNull(),
    userId: text("user_id").notNull(),
  },
  (table) => [
    index("files_created_at_idx").on(table.createdAt),
    unique("unique_file_in_project").on(table.path, table.projectId),
  ],
);

export const filesRelations = relations(files, ({ one, many }) => ({
  project: one(projects, {
    fields: [files.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [files.userId],
    references: [users.id],
  }),
  declarations: many(declarations),
}));
