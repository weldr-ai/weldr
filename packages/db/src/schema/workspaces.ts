import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { environmentVariables } from "./environment-variables";
import { flows } from "./flows";
import { resources } from "./resources";

export const workspaces = pgTable("workspaces", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  subdomain: text("subdomain").unique().notNull(),
  description: text("description"),
  executorMachineId: text("executor_machine_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  userId: text("user_id")
    .references(() => users.id, {
      onDelete: "set null",
    })
    .default(sql`NULL`),
});

export const workspacesRelations = relations(workspaces, ({ many, one }) => ({
  resources: many(resources),
  flows: many(flows),
  environmentVariables: many(environmentVariables),
  user: one(users, {
    fields: [workspaces.userId],
    references: [users.id],
  }),
}));
