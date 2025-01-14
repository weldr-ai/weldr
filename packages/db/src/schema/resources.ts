import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { endpointDefinitions } from "./endpoints";
import { environmentVariables } from "./environment-variables";
import { funcDefinitions } from "./funcs";
import { integrations } from "./integrations";
import { projects } from "./projects";

export const resources = pgTable(
  "resources",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name").notNull(),
    description: text("description"),
    isDeployed: boolean("is_deployed").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    integrationId: text("integration_id")
      .references(() => integrations.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => ({
    uniqueNameInProject: unique().on(t.name, t.projectId),
    createdAtIdx: index("resources_created_at_idx").on(t.createdAt),
  }),
);

export const resourcesRelations = relations(resources, ({ one, many }) => ({
  project: one(projects, {
    fields: [resources.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [resources.userId],
    references: [users.id],
  }),
  integration: one(integrations, {
    fields: [resources.integrationId],
    references: [integrations.id],
  }),
  funcDefinitions: many(funcDefinitions),
  endpointDefinitions: many(endpointDefinitions),
}));

export const resourceEnvironmentVariables = pgTable(
  "resource_environment_variables",
  {
    mapTo: text("map_to").notNull(),
    resourceId: text("resource_id")
      .references(() => resources.id, { onDelete: "cascade" })
      .notNull(),
    environmentVariableId: text("environment_variable_id")
      .references(() => environmentVariables.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.resourceId, t.environmentVariableId] }),
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
