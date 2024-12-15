import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { funcs } from "./funcs";
import { integrations } from "./integrations";
import { workspaces } from "./workspaces";

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
  workspaceId: text("workspace_id").references(() => workspaces.id, {
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
  workspace: one(workspaces, {
    fields: [modules.workspaceId],
    references: [workspaces.id],
  }),
  integration: one(integrations, {
    fields: [modules.integrationId],
    references: [integrations.id],
  }),
}));
