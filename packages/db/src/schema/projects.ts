import { nanoid } from "@weldr/shared/nanoid";
import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { environmentVariables } from "./environment-variables";
import { integrations } from "./integrations";
import { versions } from "./versions";

export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey().$defaultFn(nanoid),
    title: text("title"),
    subdomain: text("subdomain").unique().notNull(),
    initiatedAt: timestamp("initiated_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => [index("projects_created_at_idx").on(t.createdAt)],
);

export const projectRelations = relations(projects, ({ many, one }) => ({
  environmentVariables: many(environmentVariables),
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  versions: many(versions),
  integrations: many(integrations),
}));
