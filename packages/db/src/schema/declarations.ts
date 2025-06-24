import { nanoid } from "@weldr/shared/nanoid";
import type { DeclarationSpecs } from "@weldr/shared/types";
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
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { canvasNodes } from "./canvas-nodes";
import { chats } from "./chats";
import { dependencies } from "./dependencies";
import { integrations } from "./integrations";
import { projects } from "./projects";
import { declarationTypes } from "./shared-enums";
import { versionDeclarations } from "./versions";

export const declarations = pgTable(
  "declarations",
  {
    id: text("id").primaryKey().$defaultFn(nanoid),
    type: declarationTypes("type").notNull(),
    name: text("name").notNull(),
    specs: jsonb().$type<DeclarationSpecs>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    previousId: text("previous_id").references(
      (): AnyPgColumn => declarations.id,
    ),
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    locationId: text("location_id").references(() => locations.id),
    packages: jsonb("packages").$type<string[]>().default([]).notNull(),
    canvasNodeId: text("canvas_node_id").references(() => canvasNodes.id),
  },
  (table) => [index("declaration_created_at_idx").on(table.createdAt)],
);

export const declarationsRelations = relations(
  declarations,
  ({ one, many }) => ({
    canvasNode: one(canvasNodes, {
      fields: [declarations.canvasNodeId],
      references: [canvasNodes.id],
    }),
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
      relationName: "dependency_declaration",
    }),
    dependents: many(dependencies, {
      relationName: "dependent_declaration",
    }),
    location: one(locations, {
      fields: [declarations.locationId],
      references: [locations.id],
    }),
    versions: many(versionDeclarations),
    chats: many(chats),
  }),
);

export const locations = pgTable(
  "locations",
  {
    id: text("id").primaryKey().$defaultFn(nanoid),
    startLine: integer("start_line").notNull(),
    endLine: integer("end_line").notNull(),
    path: text("path").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("locations_created_at_idx").on(table.createdAt)],
);

export const locationRelations = relations(locations, ({ one }) => ({
  declaration: one(declarations, {
    fields: [locations.id],
    references: [declarations.locationId],
  }),
}));

export const declarationIntegrations = pgTable(
  "declaration_integrations",
  {
    declarationId: text("declaration_id")
      .references(() => declarations.id, { onDelete: "cascade" })
      .notNull(),
    integrationId: text("integration_id")
      .references(() => integrations.id, { onDelete: "cascade" })
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.declarationId, table.integrationId] }),
  ],
);

export const declarationIntegrationsRelations = relations(
  declarationIntegrations,
  ({ one }) => ({
    declaration: one(declarations, {
      fields: [declarationIntegrations.declarationId],
      references: [declarations.id],
    }),
    integration: one(integrations, {
      fields: [declarationIntegrations.integrationId],
      references: [integrations.id],
    }),
  }),
);
