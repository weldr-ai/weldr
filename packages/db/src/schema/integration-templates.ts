import { nanoid } from "@weldr/shared/nanoid";
import type { IntegrationKey, IntegrationType } from "@weldr/shared/types";
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const integrationTemplates = pgTable(
  "integration_templates",
  {
    id: text("id").primaryKey().$defaultFn(nanoid),
    name: text("name").notNull(),
    description: text("description"),
    type: text("type").$type<IntegrationType>().notNull(),
    key: text("key").$type<IntegrationKey>().notNull(),
    version: text("version").notNull(),
    isSystemManaged: boolean("is_system_managed").notNull().default(false),
    allowMultiple: boolean("allow_multiple").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("integration_templates_created_at_idx").on(t.createdAt),
    index("integration_templates_type_idx").on(t.type),
    index("integration_templates_system_managed_idx").on(t.isSystemManaged),
    uniqueIndex("integration_templates_key_version_idx").on(t.key, t.version),
  ],
);

export const integrationTemplatesRelations = relations(
  integrationTemplates,
  ({ many }) => ({
    variables: many(integrationTemplateVariables),
  }),
);

export const integrationTemplateVariables = pgTable(
  "integration_template_variables",
  {
    id: text("id").primaryKey().$defaultFn(nanoid),
    integrationTemplateId: text("integration_template_id")
      .notNull()
      .references(() => integrationTemplates.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    isRequired: boolean("is_required").notNull().default(false),
  },
  (t) => [
    index("integration_template_variables_integration_template_idx").on(
      t.integrationTemplateId,
    ),
  ],
);

export const integrationTemplateVariablesRelations = relations(
  integrationTemplateVariables,
  ({ one }) => ({
    integrationTemplate: one(integrationTemplates, {
      fields: [integrationTemplateVariables.integrationTemplateId],
      references: [integrationTemplates.id],
    }),
  }),
);
