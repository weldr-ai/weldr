import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import {
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { environmentVariables } from "./environment-variables";
import { integrations } from "./integrations";
import { workspaces } from "./workspaces";

export const resources = pgTable(
  "resources",
  {
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
    workspaceId: text("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    integrationId: text("integration_id")
      .references(() => integrations.id, { onDelete: "cascade" })
      .notNull(),
    createdBy: text("created_by")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => ({
    uniqueNameInWorkspace: unique().on(t.name, t.workspaceId),
  }),
);

export const resourcesRelations = relations(resources, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [resources.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [resources.createdBy],
    references: [users.id],
  }),
  integration: one(integrations, {
    fields: [resources.integrationId],
    references: [integrations.id],
  }),
}));

export const resourceEnvironmentVariables = pgTable(
  "resource_environment_variables",
  {
    resourceId: text("resource_id")
      .references(() => resources.id, { onDelete: "cascade" })
      .notNull(),
    environmentVariableId: text("environment_variable_id")
      .references(() => environmentVariables.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.resourceId, t.environmentVariableId] }),
    uniqueResourceEnvironmentVariable: unique().on(
      t.resourceId,
      t.environmentVariableId,
    ),
  }),
);

export const resourceEnvironmentVariablesRelations = relations(
  resourceEnvironmentVariables,
  ({ one }) => ({
    resource: one(resources, {
      fields: [resourceEnvironmentVariables.resourceId],
      references: [resources.id],
    }),
    environmentVariable: one(environmentVariables, {
      fields: [resourceEnvironmentVariables.environmentVariableId],
      references: [environmentVariables.id],
    }),
  }),
);
