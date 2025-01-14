import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { conversationMessages } from "./conversations";
import { endpointDefinitions } from "./endpoints";
import { funcDefinitions } from "./funcs";
import { packages } from "./packages";
import { projects } from "./projects";

export const versions = pgTable(
  "versions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    versionNumber: integer("version_number").notNull(),
    versionName: text("version_name").notNull(),
    isActive: boolean("is_active").notNull().default(false),
    parentVersionId: text("parent_version_id").references(
      (): AnyPgColumn => versions.id,
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    messageId: text("message_id").references(() => conversationMessages.id),
    projectId: text("project_id")
      .references(() => projects.id)
      .notNull(),
  },
  (t) => ({
    createdAtIdx: index("versions_created_at_idx").on(t.createdAt),
    versionNumberIdx: index("versions_version_number_idx").on(t.versionNumber),
  }),
);

export const versionRelations = relations(versions, ({ one, many }) => ({
  user: one(users, {
    fields: [versions.userId],
    references: [users.id],
  }),
  parentVersion: one(versions, {
    fields: [versions.parentVersionId],
    references: [versions.id],
  }),
  childVersions: many(versions),
  endpointDefinitions: many(versionEndpointDefinitions, {
    relationName: "version_endpoint_definition",
  }),
  funcDefinitions: many(versionFuncDefinitions, {
    relationName: "version_func_definition",
  }),
  packages: many(versionPackages, {
    relationName: "version_packages",
  }),
}));

export const versionFuncDefinitions = pgTable(
  "version_func_definitions",
  {
    versionId: text("version_id")
      .references(() => versions.id)
      .notNull(),
    funcDefinitionId: text("func_definition_id")
      .references(() => funcDefinitions.id)
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.versionId, t.funcDefinitionId] }),
  }),
);

export const versionFuncDefinitionRelations = relations(
  versionFuncDefinitions,
  ({ one }) => ({
    version: one(versions, {
      relationName: "version_func_definition",
      fields: [versionFuncDefinitions.versionId],
      references: [versions.id],
    }),
    funcDefinition: one(funcDefinitions, {
      fields: [versionFuncDefinitions.funcDefinitionId],
      references: [funcDefinitions.id],
    }),
  }),
);

export const versionEndpointDefinitions = pgTable(
  "version_endpoint_definitions",
  {
    versionId: text("version_id")
      .references(() => versions.id)
      .notNull(),
    endpointDefinitionId: text("endpoint_definition_id")
      .references(() => endpointDefinitions.id)
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({
      columns: [t.versionId, t.endpointDefinitionId],
    }),
  }),
);

export const versionEndpointDefinitionRelations = relations(
  versionEndpointDefinitions,
  ({ one }) => ({
    version: one(versions, {
      relationName: "version_endpoint_definition",
      fields: [versionEndpointDefinitions.versionId],
      references: [versions.id],
    }),
    endpointDefinition: one(endpointDefinitions, {
      fields: [versionEndpointDefinitions.endpointDefinitionId],
      references: [endpointDefinitions.id],
    }),
  }),
);

export const versionPackages = pgTable(
  "version_packages",
  {
    versionId: text("version_id")
      .references(() => versions.id)
      .notNull(),
    packageId: text("package_id")
      .references(() => packages.id)
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.versionId, t.packageId] }),
  }),
);

export const versionPackageRelations = relations(
  versionPackages,
  ({ one }) => ({
    version: one(versions, {
      relationName: "version_packages",
      fields: [versionPackages.versionId],
      references: [versions.id],
    }),
    package: one(packages, {
      relationName: "version_packages",
      fields: [versionPackages.packageId],
      references: [packages.id],
    }),
  }),
);
