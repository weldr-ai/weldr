import { createId } from "@paralleldrive/cuid2";
import type { DeclarationMetadata } from "@weldr/shared/types";
import { relations } from "drizzle-orm";
import {
  type AnyPgColumn,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { dependencies } from "./dependencies";
import { files } from "./files";
import { packages } from "./packages";
import { projects } from "./projects";
import { declarationTypes } from "./shared-enums";
import { versionDeclarations } from "./versions";

export const declarations = pgTable(
  "declarations",
  {
    id: text("id")
      .$default(() => createId())
      .primaryKey()
      .notNull(),
    type: declarationTypes("type").notNull(),
    link: text("link").notNull(),
    metadata: jsonb().$type<DeclarationMetadata>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    previousId: text("previous_id").references(
      (): AnyPgColumn => declarations.id,
    ),
    projectId: text("project_id")
      .references(() => projects.id)
      .notNull(),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    fileId: text("file_id")
      .references(() => files.id)
      .notNull(),
  },
  (table) => ({
    createdAtIdx: index("declaration_created_at_idx").on(table.createdAt),
    uniqueLink: unique("unique_link").on(table.projectId, table.link),
  }),
);

export const declarationsRelations = relations(
  declarations,
  ({ one, many }) => ({
    previous: many(declarations),
    project: one(projects, {
      fields: [declarations.projectId],
      references: [projects.id],
    }),
    user: one(users, {
      fields: [declarations.userId],
      references: [users.id],
    }),
    dependencies: many(dependencies, {
      relationName: "dependencies",
    }),
    dependents: many(dependencies, {
      relationName: "dependents",
    }),
    file: one(files, {
      fields: [declarations.fileId],
      references: [files.id],
    }),
    declarationPackages: many(declarationPackages),
    versions: many(versionDeclarations),
  }),
);

export const declarationPackages = pgTable(
  "declaration_packages",
  {
    declarationId: text("declaration_id")
      .references(() => declarations.id)
      .notNull(),
    packageId: text("package_id")
      .references(() => packages.id)
      .notNull(),
    declarations: text("declarations").array(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.declarationId, table.packageId] }),
  }),
);

export const declarationPackagesRelations = relations(
  declarationPackages,
  ({ one }) => ({
    package: one(packages, {
      fields: [declarationPackages.packageId],
      references: [packages.id],
    }),
    declaration: one(declarations, {
      fields: [declarationPackages.declarationId],
      references: [declarations.id],
    }),
  }),
);
