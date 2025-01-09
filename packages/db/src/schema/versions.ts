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
import { endpoints } from "./endpoints";
import { funcs } from "./funcs";
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

export const versionsRelations = relations(versions, ({ one, many }) => ({
  user: one(users, {
    fields: [versions.userId],
    references: [users.id],
  }),
  parentVersion: one(versions, {
    fields: [versions.parentVersionId],
    references: [versions.id],
  }),
  childVersions: many(versions),
  endpoints: many(versionEndpoints),
  funcs: many(versionFuncs),
  packages: many(versionPackages),
}));

export const versionFuncs = pgTable(
  "version_funcs",
  {
    versionId: text("version_id")
      .references(() => versions.id)
      .notNull(),
    funcId: text("func_id")
      .references(() => funcs.id)
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.versionId, t.funcId] }),
  }),
);

export const versionFuncRelations = relations(versionFuncs, ({ one }) => ({
  version: one(versions, {
    fields: [versionFuncs.versionId],
    references: [versions.id],
  }),
  func: one(funcs, {
    fields: [versionFuncs.funcId],
    references: [funcs.id],
  }),
}));

export const versionEndpoints = pgTable(
  "version_endpoints",
  {
    versionId: text("version_id")
      .references(() => versions.id)
      .notNull(),
    endpointId: text("endpoint_id")
      .references(() => endpoints.id)
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({
      columns: [t.versionId, t.endpointId],
    }),
  }),
);

export const versionEndpointRelations = relations(
  versionEndpoints,
  ({ one }) => ({
    version: one(versions, {
      fields: [versionEndpoints.versionId],
      references: [versions.id],
    }),
    endpoint: one(endpoints, {
      fields: [versionEndpoints.endpointId],
      references: [endpoints.id],
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
      fields: [versionPackages.versionId],
      references: [versions.id],
    }),
    package: one(packages, {
      fields: [versionPackages.packageId],
      references: [packages.id],
    }),
  }),
);
