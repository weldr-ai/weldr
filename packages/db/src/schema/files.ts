import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { declarations } from "./declarations";
import { projects } from "./projects";

export const files = pgTable(
  "files",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => createId()),
    path: text().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    projectId: text("project_id")
      .references(() => projects.id)
      .notNull(),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("files_created_at_idx").on(table.createdAt),
    uniqueIndex("not_deleted_unique_file_in_project")
      .on(table.path, table.projectId)
      .where(sql`(deleted_at IS NULL)`),
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
