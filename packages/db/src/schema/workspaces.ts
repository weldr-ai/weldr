import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { users } from "./auth";
import { flows } from "./flows";
import { resources } from "./resources";

export const workspaces = pgTable("workspaces", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  createdBy: text("created_by")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
});

export const workspacesRelations = relations(workspaces, ({ many, one }) => ({
  resources: many(resources),
  flows: many(flows),
  user: one(users, {
    fields: [workspaces.createdBy],
    references: [users.id],
  }),
}));

// Zod schemas
export const workspaceSchema = createSelectSchema(workspaces);
export const insertWorkspaceSchema = createInsertSchema(workspaces, {
  name: (schema) =>
    schema.name
      .trim()
      .min(1, {
        message: "Name is required.",
      })
      .transform((name) => name.replace(/\s+/g, " ").trim()),
});
