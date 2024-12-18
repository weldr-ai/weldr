import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { funcs } from "./funcs";
import { integrations } from "./integrations";
import { projects } from "./projects";

export const modules = pgTable("modules", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  description: text("description"),
  path: text("path"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  projectId: text("project_id").references(() => projects.id, {
    onDelete: "cascade",
  }),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  integrationId: text("integration_id").references(() => integrations.id, {
    onDelete: "cascade",
  }),
});

export const modulesRelations = relations(modules, ({ many, one }) => ({
  funcs: many(funcs),
  user: one(users, {
    fields: [modules.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [modules.projectId],
    references: [projects.id],
  }),
  integration: one(integrations, {
    fields: [modules.integrationId],
    references: [integrations.id],
  }),
}));
