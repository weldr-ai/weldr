import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import { pgEnum, pgTable, text } from "drizzle-orm/pg-core";
import { funcs } from "./funcs";
import { resources } from "./resources";

export const integrationTypes = pgEnum("integration_type", [
  "postgres",
  "mysql",
]);

export const integrationCategories = pgEnum("integration_category", [
  "database",
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
  category: integrationCategories("category").default(sql`NULL`),
});

export const integrationsRelations = relations(integrations, ({ many }) => ({
  resources: many(resources),
  funcs: many(funcs),
}));
