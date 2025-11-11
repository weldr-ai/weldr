import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { nanoid } from "@weldr/shared/nanoid";
import type {
  IntegrationInstallationStatus,
  IntegrationKey,
  IntegrationOptions,
} from "@weldr/shared/types";

import { users } from "./auth";
import { declarations } from "./declarations";
import { environmentVariables } from "./environment-variables";
import { integrationTemplates } from "./integration-templates";
import { projects } from "./projects";
import { versions } from "./versions";

export const integrations = pgTable(
  "integrations",
  {
    id: text("id").primaryKey().$defaultFn(nanoid),
    key: text("key").$type<IntegrationKey>().notNull(),
    name: text("name"),
    options: jsonb("options").$type<IntegrationOptions>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    integrationTemplateId: text("integration_template_id")
      .references(() => integrationTemplates.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => [index("integrations_created_at_idx").on(t.createdAt)],
);

export const integrationsRelations = relations(
  integrations,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [integrations.projectId],
      references: [projects.id],
    }),
    user: one(users, {
      fields: [integrations.userId],
      references: [users.id],
    }),
    integrationTemplate: one(integrationTemplates, {
      fields: [integrations.integrationTemplateId],
      references: [integrationTemplates.id],
    }),
    environmentVariableMappings: many(integrationEnvironmentVariables),
    declarations: many(declarations),
    installations: many(integrationInstallations),
  }),
);

export const integrationEnvironmentVariables = pgTable(
  "integration_environment_variables",
  {
    mapTo: text("map_to").notNull(),
    integrationId: text("integration_id")
      .references(() => integrations.id, { onDelete: "cascade" })
      .notNull(),
    environmentVariableId: text("environment_variable_id")
      .references(() => environmentVariables.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.integrationId, t.environmentVariableId, t.mapTo],
    }),
  ],
);

export const integrationEnvironmentVariablesRelations = relations(
  integrationEnvironmentVariables,
  ({ one }) => ({
    integration: one(integrations, {
      fields: [integrationEnvironmentVariables.integrationId],
      references: [integrations.id],
    }),
    environmentVariable: one(environmentVariables, {
      fields: [integrationEnvironmentVariables.environmentVariableId],
      references: [environmentVariables.id],
    }),
  }),
);

export const integrationInstallations = pgTable(
  "integration_installations",
  {
    id: text("id").primaryKey().$defaultFn(nanoid),
    integrationId: text("integration_id")
      .references(() => integrations.id, { onDelete: "cascade" })
      .notNull(),
    versionId: text("version_id")
      .references(() => versions.id, { onDelete: "cascade" })
      .notNull(),
    status: text("status")
      .$type<IntegrationInstallationStatus>()
      .notNull()
      .default("installing"),
    installedAt: timestamp("installed_at"),
    installationMetadata: jsonb("installation_metadata").$type<{
      filesCreated?: string[];
      packagesInstalled?: string[];
      declarationsAdded?: string[];
      error?: string;
    }>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("integration_installations_unique_idx").on(
      t.integrationId,
      t.versionId,
    ),
    index("integration_installations_version_idx").on(t.versionId),
    index("integration_installations_integration_idx").on(t.integrationId),
    index("integration_installations_status_idx").on(t.status),
  ],
);

export const integrationInstallationsRelations = relations(
  integrationInstallations,
  ({ one }) => ({
    integration: one(integrations, {
      fields: [integrationInstallations.integrationId],
      references: [integrations.id],
    }),
    version: one(versions, {
      fields: [integrationInstallations.versionId],
      references: [versions.id],
    }),
  }),
);
