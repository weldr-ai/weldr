import type {
  OpenApiEndpointSpec,
  ResourceMetadata,
} from "@integramind/shared/types";
import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import {
  type AnyPgColumn,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { conversations } from "./conversations";
import { dependencies } from "./dependencies";
import { packages } from "./packages";
import { projects } from "./projects";
import { resources } from "./resources";
import { versions } from "./versions";

export const httpMethods = pgEnum("http_methods", [
  "get",
  "post",
  "put",
  "patch",
  "delete",
]);

export const endpoints = pgTable(
  "endpoints",
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
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    conversationId: text("conversation_id")
      .references(() => conversations.id)
      .notNull(),
    projectId: text("project_id")
      .references(() => projects.id)
      .notNull(),
    currentDefinitionId: text("current_definition_id").references(
      (): AnyPgColumn => endpointDefinitions.id,
    ),
  },
  (t) => ({
    createdAtIdx: index("endpoints_created_at_idx").on(t.createdAt),
  }),
);

export const endpointsRelations = relations(endpoints, ({ one, many }) => ({
  project: one(projects, {
    fields: [endpoints.projectId],
    references: [projects.id],
  }),
  conversation: one(conversations, {
    fields: [endpoints.conversationId],
    references: [conversations.id],
  }),
  definitions: many(endpointDefinitions),
  currentDefinition: one(endpointDefinitions, {
    fields: [endpoints.currentDefinitionId],
    references: [endpointDefinitions.id],
  }),
}));

export const endpointDefinitions = pgTable(
  "endpoint_definitions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    path: text("path").notNull(),
    method: httpMethods("method").notNull(),
    code: text("code").notNull(),
    diff: text("diff").notNull(),
    openApiSpec: jsonb("open_api_spec").$type<OpenApiEndpointSpec>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    endpointId: text("endpoint_id")
      .references(() => endpoints.id)
      .notNull(),
    previousId: text("previous_id").references(
      (): AnyPgColumn => endpointDefinitions.id,
    ),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    versionId: text("version_id")
      .references(() => versions.id)
      .notNull(),
  },
  (t) => ({
    uniqueEndpointInVersion: uniqueIndex("unique_endpoint_in_version").on(
      t.path,
      t.method,
      t.versionId,
    ),
    createdAtIdx: index("endpoint_data_created_at_idx").on(t.createdAt),
  }),
);

export const endpointDefinitionRelations = relations(
  endpointDefinitions,
  ({ one, many }) => ({
    endpoint: one(endpoints, {
      fields: [endpointDefinitions.endpointId],
      references: [endpoints.id],
    }),
    user: one(users, {
      fields: [endpointDefinitions.userId],
      references: [users.id],
    }),
    previous: one(endpointDefinitions, {
      fields: [endpointDefinitions.previousId],
      references: [endpointDefinitions.id],
    }),
    children: many(endpointDefinitions),
    resources: many(endpointDefinitionResources),
    packages: many(endpointDefinitionPackages),
    funcDefinitionDependencies: many(dependencies, {
      relationName: "dependency_func_definition",
    }),
  }),
);

export const endpointDefinitionResources = pgTable(
  "endpoint_definition_resources",
  {
    endpointDefinitionId: text("endpoint_definition_id")
      .references(() => endpointDefinitions.id, { onDelete: "cascade" })
      .notNull(),
    resourceId: text("resource_id")
      .references(() => resources.id, { onDelete: "cascade" })
      .notNull(),
    metadata: jsonb("metadata").$type<ResourceMetadata>(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.endpointDefinitionId, t.resourceId] }),
  }),
);

export const endpointDefinitionResourcesRelations = relations(
  endpointDefinitionResources,
  ({ one }) => ({
    resource: one(resources, {
      fields: [endpointDefinitionResources.resourceId],
      references: [resources.id],
    }),
    endpointDefinition: one(endpointDefinitions, {
      fields: [endpointDefinitionResources.endpointDefinitionId],
      references: [endpointDefinitions.id],
    }),
  }),
);

export const endpointDefinitionPackages = pgTable(
  "endpoint_definition_packages",
  {
    packageId: text("package_id")
      .references(() => packages.id, { onDelete: "cascade" })
      .notNull(),
    endpointDefinitionId: text("endpoint_definition_id")
      .references(() => endpointDefinitions.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.packageId, t.endpointDefinitionId] }),
  }),
);

export const endpointDefinitionPackagesRelations = relations(
  endpointDefinitionPackages,
  ({ one }) => ({
    package: one(packages, {
      fields: [endpointDefinitionPackages.packageId],
      references: [packages.id],
    }),
    endpointDefinition: one(endpointDefinitions, {
      fields: [endpointDefinitionPackages.endpointDefinitionId],
      references: [endpointDefinitions.id],
    }),
  }),
);
