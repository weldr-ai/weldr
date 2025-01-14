import type {
  JsonSchema,
  RawContent,
  ResourceMetadata,
} from "@integramind/shared/types";
import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import {
  type AnyPgColumn,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { conversations } from "./conversations";
import { dependencies } from "./dependencies";
import { integrations } from "./integrations";
import { packages } from "./packages";
import { projects } from "./projects";
import { resources } from "./resources";
import { versions } from "./versions";

export const funcs = pgTable(
  "funcs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    positionX: integer("position_x").default(0),
    positionY: integer("position_y").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id").references(() => conversations.id),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    integrationId: text("integration_id").references(() => integrations.id, {
      onDelete: "cascade",
    }),
    currentDefinitionId: text("current_definition_id").references(
      (): AnyPgColumn => funcDefinitions.id,
    ),
  },
  (t) => ({
    createdAtIdx: index("funcs_created_at_idx").on(t.createdAt),
  }),
);

export const funcRelations = relations(funcs, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [funcs.conversationId],
    references: [conversations.id],
  }),
  project: one(projects, {
    fields: [funcs.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [funcs.userId],
    references: [users.id],
  }),
  integration: one(integrations, {
    fields: [funcs.integrationId],
    references: [integrations.id],
  }),
  definitions: many(funcDefinitions),
  currentDefinition: one(funcDefinitions, {
    fields: [funcs.currentDefinitionId],
    references: [funcDefinitions.id],
  }),
}));

export const funcDefinitions = pgTable(
  "func_definitions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name").notNull(),
    inputSchema: jsonb("input_schema").$type<JsonSchema>(),
    outputSchema: jsonb("output_schema").$type<JsonSchema>(),
    rawDescription: jsonb("raw_description").$type<RawContent>().notNull(),
    behavior: jsonb("behavior").$type<RawContent>().notNull(),
    errors: text("errors"),
    docs: text("docs").notNull(),
    code: text("code").notNull(),
    diff: text("diff").notNull(),
    testInput: jsonb("test_input").$type<unknown>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    previousId: text("previous_id").references(
      (): AnyPgColumn => funcDefinitions.id,
    ),
    funcId: text("func_id")
      .references(() => funcs.id)
      .notNull(),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    versionId: text("version_id")
      .references(() => versions.id)
      .notNull(),
  },
  (t) => ({
    uniqueFuncInVersion: uniqueIndex("unique_func_in_version").on(
      t.name,
      t.versionId,
    ),
    createdAtIdx: index("func_data_created_at_idx").on(t.createdAt),
  }),
);

export const funcDefinitionRelations = relations(
  funcDefinitions,
  ({ one, many }) => ({
    func: one(funcs, {
      fields: [funcDefinitions.funcId],
      references: [funcs.id],
    }),
    user: one(users, {
      fields: [funcDefinitions.userId],
      references: [users.id],
    }),
    previous: one(funcDefinitions, {
      fields: [funcDefinitions.previousId],
      references: [funcDefinitions.id],
    }),
    children: many(funcDefinitions),
    resources: many(funcDefinitionResources),
    packages: many(funcDefinitionPackages),
    funcDefinitionDependents: many(dependencies, {
      relationName: "dependent_func_definition",
    }),
    endpointDefinitionDependents: many(dependencies, {
      relationName: "dependent_endpoint_definition",
    }),
    funcDefinitionDependencies: many(dependencies, {
      relationName: "dependency_func_definition",
    }),
  }),
);

export const funcDefinitionResources = pgTable(
  "func_definition_resources",
  {
    funcDefinitionId: text("func_definition_id")
      .references(() => funcDefinitions.id, { onDelete: "cascade" })
      .notNull(),
    resourceId: text("resource_id")
      .references(() => resources.id, { onDelete: "cascade" })
      .notNull(),
    metadata: jsonb("metadata").$type<ResourceMetadata>(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.funcDefinitionId, t.resourceId] }),
  }),
);

export const funcDefinitionResourcesRelations = relations(
  funcDefinitionResources,
  ({ one }) => ({
    funcDefinition: one(funcDefinitions, {
      fields: [funcDefinitionResources.funcDefinitionId],
      references: [funcDefinitions.id],
    }),
    resource: one(resources, {
      fields: [funcDefinitionResources.resourceId],
      references: [resources.id],
    }),
  }),
);

export const funcDefinitionPackages = pgTable(
  "func_definition_packages",
  {
    funcDefinitionId: text("func_definition_id")
      .references(() => funcDefinitions.id, { onDelete: "cascade" })
      .notNull(),
    packageId: text("package_id")
      .references(() => packages.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.funcDefinitionId, t.packageId] }),
  }),
);

export const funcDefinitionPackagesRelations = relations(
  funcDefinitionPackages,
  ({ one }) => ({
    funcDefinition: one(funcDefinitions, {
      fields: [funcDefinitionPackages.funcDefinitionId],
      references: [funcDefinitions.id],
    }),
    package: one(packages, {
      fields: [funcDefinitionPackages.packageId],
      references: [packages.id],
    }),
  }),
);
