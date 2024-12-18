import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { endpoints } from "./endpoints";
import { environmentVariables } from "./environment-variables";
import { modules } from "./modules";
import { resources } from "./resources";

export const projects = pgTable("projects", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  subdomain: text("subdomain").unique().notNull(),
  description: text("description"),
  engineMachineId: text("engine_machine_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
});

export const projectRelations = relations(projects, ({ many, one }) => ({
  resources: many(resources),
  modules: many(modules),
  endpoints: many(endpoints),
  environmentVariables: many(environmentVariables),
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
}));
