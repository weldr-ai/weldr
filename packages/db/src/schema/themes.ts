import { relations } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { nanoid } from "@weldr/shared/nanoid";
import type { Theme } from "@weldr/shared/types";

import { users } from "./auth";
import { projects } from "./projects";

export const themes = pgTable("themes", {
  id: text("id").primaryKey().$defaultFn(nanoid),
  data: jsonb("data").$type<Theme>().notNull(),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const themesRelations = relations(themes, ({ one }) => ({
  project: one(projects, {
    fields: [themes.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [themes.userId],
    references: [users.id],
  }),
}));
