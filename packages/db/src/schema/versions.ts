import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
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
import { declarations } from "./declarations";
import { files } from "./files";
import { packages } from "./packages";
import { projects } from "./projects";

export const versionProgress = pgEnum("version_progress", [
  "initiated",
  "coded",
  "enriched",
  "deployed",
  "succeeded",
  "failed",
]);

export const versions = pgTable(
  "versions",
  {
    id: text("id")
      .$default(() => createId())
      .primaryKey()
      .notNull(),
    number: integer("number").notNull(),
    message: text("message").notNull(),
    description: text("description").notNull(),
    machineId: text("machine_id"),
    progress: versionProgress("progress").default("initiated").notNull(),
    changedFiles: jsonb("changed_files")
      .$type<string[]>()
      .default([])
      .notNull(),
    isCurrent: boolean("is_current").default(false).notNull(),
    parentVersionId: text("parent_version_id").references(
      (): AnyPgColumn => versions.id,
      { onDelete: "cascade" },
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
  },
  (table) => ({
    currentVersionIdx: uniqueIndex("current_version_idx")
      .on(table.projectId, table.isCurrent)
      .where(sql`(is_current = true)`),
    versionNumberUniqueIdx: uniqueIndex("version_number_unique_idx").on(
      table.projectId,
      table.number,
    ),
    createdAtIdx: index("versions_created_at_idx").on(table.createdAt),
    machineIdIdx: index("versions_machine_id_idx").on(table.machineId),
  }),
);

export const versionsRelations = relations(versions, ({ one, many }) => ({
  parent: one(versions, {
    fields: [versions.parentVersionId],
    references: [versions.id],
    relationName: "version_parent",
  }),
  children: many(versions, {
    relationName: "version_children",
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
    versionId: text("version_id")
      .references(() => versions.id, { onDelete: "cascade" })
      .notNull(),
    fileId: text("file_id")
      .references(() => files.id, { onDelete: "cascade" })
      .notNull(),
    s3VersionId: text("s3_version_id").notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.versionId, table.fileId, table.s3VersionId],
    }),
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
    versionId: text("version_id")
      .references(() => versions.id, { onDelete: "cascade" })
      .notNull(),
    declarationId: text("declaration_id")
      .references(() => declarations.id, { onDelete: "cascade" })
      .notNull(),
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
    versionId: text("version_id")
      .references(() => versions.id, { onDelete: "cascade" })
      .notNull(),
    packageId: text("package_id")
      .references(() => packages.id, { onDelete: "cascade" })
      .notNull(),
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
