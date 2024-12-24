import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { integer, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { funcs } from "./funcs";
import { integrations } from "./integrations";
import { projects } from "./projects";

export const modules = pgTable(
  "modules",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name"),
    description: text("description"),
    path: text("path"),
    positionX: integer("position_x").default(0),
    positionY: integer("position_y").default(0),
    width: integer("width").default(600),
    height: integer("height").default(400),
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
  },
  (table) => ({
    uniqueProjectModule: unique().on(table.projectId, table.name),
  }),
);

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
