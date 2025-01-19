import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { endpoints } from "./endpoints";
import { environmentVariables } from "./environment-variables";
import { funcs } from "./funcs";
import { resources } from "./resources";

export const projects = pgTable(
  "projects",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name").notNull(),
    subdomain: text("subdomain").unique().notNull(),
    description: text("description"),
    thumbnail: text("thumbnail"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => ({
    createdAtIdx: index("projects_created_at_idx").on(t.createdAt),
  }),
);

export const projectRelations = relations(projects, ({ many, one }) => ({
  resources: many(resources),
  endpoints: many(endpoints),
  funcs: many(funcs),
  environmentVariables: many(environmentVariables),
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
}));
