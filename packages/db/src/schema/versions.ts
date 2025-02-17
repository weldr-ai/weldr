import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { declarations } from "./declarations";
import { files } from "./files";
import { packages } from "./packages";
import { projects } from "./projects";

export const versions = pgTable(
  "versions",
  {
    id: text("id")
      .$default(() => createId())
      .primaryKey()
      .notNull(),
    versionNumber: integer("version_number").notNull(),
    versionName: text("version_name").notNull(),
    isActive: boolean("is_active").default(false).notNull(),
    parentVersionId: text("parent_version_id").references(
      (): AnyPgColumn => versions.id,
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    projectId: text("project_id")
      .references(() => projects.id)
      .notNull(),
  },
  (table) => [
    uniqueIndex("active_version_idx")
      .on(table.projectId, table.isActive)
      .where(sql`(is_active = true)`),
    uniqueIndex("version_number_unique_idx").on(
      table.projectId,
      table.versionNumber,
    ),
    index("versions_created_at_idx").on(table.createdAt),
  ],
);

export const versionsRelations = relations(versions, ({ one, many }) => ({
  version: one(versions, {
    fields: [versions.parentVersionId],
    references: [versions.id],
    relationName: "versions_parentVersionId_versions_id",
  }),
  versions: many(versions, {
    relationName: "versions_parentVersionId_versions_id",
  }),
  project: one(projects, {
    fields: [versions.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [versions.userId],
    references: [users.id],
  }),
  declarations: many(versionDeclarations),
  packages: many(versionPackages),
  files: many(versionFiles),
}));

export const versionFiles = pgTable(
  "version_files",
  {
    versionId: text("version_id").notNull(),
    fileId: text("file_id").notNull(),
    s3VersionId: text("s3_version_id").notNull(),
    size: integer("size").notNull(),
    hash: text().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.versionId, table.fileId] }),
  }),
);

export const versionFilesRelations = relations(versionFiles, ({ one }) => ({
  file: one(files, {
    fields: [versionFiles.fileId],
    references: [files.id],
  }),
  version: one(versions, {
    fields: [versionFiles.versionId],
    references: [versions.id],
  }),
}));

export const versionDeclarations = pgTable(
  "version_declarations",
  {
    versionId: text("version_id").notNull(),
    declarationId: text("declaration_id").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.versionId, table.declarationId] }),
  }),
);

export const versionDeclarationsRelations = relations(
  versionDeclarations,
  ({ one }) => ({
    declaration: one(declarations, {
      fields: [versionDeclarations.declarationId],
      references: [declarations.id],
    }),
    version: one(versions, {
      fields: [versionDeclarations.versionId],
      references: [versions.id],
    }),
  }),
);

export const versionPackages = pgTable(
  "version_packages",
  {
    versionId: text("version_id").notNull(),
    packageId: text("package_id").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.versionId, table.packageId] }),
  }),
);

export const versionPackagesRelations = relations(
  versionPackages,
  ({ one }) => ({
    package: one(packages, {
      fields: [versionPackages.packageId],
      references: [packages.id],
    }),
    version: one(versions, {
      fields: [versionPackages.versionId],
      references: [versions.id],
    }),
  }),
);
