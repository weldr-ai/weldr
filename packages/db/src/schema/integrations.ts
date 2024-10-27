import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import { jsonb, pgEnum, pgTable, text } from "drizzle-orm/pg-core";
import { resources } from "./resources";

export const integrationTypes = pgEnum("integration_type", [
  "postgres",
  "mysql",
]);

export const integrations = pgTable("integrations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  type: integrationTypes("type").notNull(),
  version: text("version").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  environmentVariables: text("environment_variables")
    .array()
    .default(sql`NULL`),
  dependencies: jsonb("dependencies")
    .$type<{ name: string; version?: string }[]>()
    .notNull(),
});

export const integrationsRelations = relations(integrations, ({ many }) => ({
  resources: many(resources),
  utils: many(integrationUtils),
}));

export const integrationUtils = pgTable("integration_utils", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  description: text("description").notNull(),
  implementation: text("implementation").notNull(),
  integrationId: text("integration_id")
    .references(() => integrations.id, { onDelete: "cascade" })
    .notNull(),
});

export const integrationUtilsRelations = relations(
  integrationUtils,
  ({ one }) => ({
    integration: one(integrations, {
      fields: [integrationUtils.integrationId],
      references: [integrations.id],
    }),
  }),
);
