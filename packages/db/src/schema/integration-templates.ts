import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { nanoid } from "@weldr/shared/nanoid";
import type {
  IntegrationCategory,
  IntegrationKey,
  IntegrationTemplateDependencies,
  IntegrationTemplateOptions,
  IntegrationTemplateRecommendedOptions,
  IntegrationTemplateVariable,
} from "@weldr/shared/types";

export const integrationTemplates = pgTable(
  "integration_templates",
  {
    id: text("id").primaryKey().$defaultFn(nanoid),
    name: text("name").notNull(),
    description: text("description").notNull(),
    category: text("category").$type<IntegrationCategory>().notNull(),
    key: text("key").$type<IntegrationKey>().notNull(),
    version: text("version").notNull(),
    dependencies:
      jsonb("dependencies").$type<IntegrationTemplateDependencies>(),
    variables: jsonb("variables").$type<IntegrationTemplateVariable>(),
    options: jsonb("options").$type<IntegrationTemplateOptions>(),
    recommendedOptions: jsonb(
      "recommended_options",
    ).$type<IntegrationTemplateRecommendedOptions>(),
    allowMultiple: boolean("allow_multiple").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("integration_templates_created_at_idx").on(t.createdAt),
    index("integration_templates_category_idx").on(t.category),
    uniqueIndex("integration_templates_key_version_idx").on(t.key, t.version),
  ],
);
