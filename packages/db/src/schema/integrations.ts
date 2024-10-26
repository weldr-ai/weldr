import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const integrations = pgTable("integrations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  version: text("version").notNull(),
  description: text("description").notNull(),
  dependencies: text("dependencies").array().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const integrationsRelations = relations(integrations, ({ many }) => ({
  utils: many(integrationUtils),
  env: many(integrationEnv),
}));

export const integrationUtils = pgTable(
  "integration_utils",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name").unique().notNull(),
    implementation: text("implementation").notNull(),
    docs: text("docs").notNull(),
    integrationId: text("integration_id")
      .references(() => integrations.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => ({
    uniqueNameInIntegration: uniqueIndex("integration_utils_name_idx").on(
      t.name,
      t.integrationId,
    ),
  }),
);

export const integrationUtilsRelations = relations(
  integrationUtils,
  ({ one }) => ({
    integration: one(integrations, {
      fields: [integrationUtils.integrationId],
      references: [integrations.id],
    }),
  }),
);

export const integrationEnv = pgTable(
  "integration_env",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name").notNull(),
    description: text("description").notNull(),
    integrationId: text("integration_id")
      .references(() => integrations.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => ({
    uniqueNameInIntegration: uniqueIndex("integration_env_name_idx").on(
      t.name,
      t.integrationId,
    ),
  }),
);

export const integrationEnvRelations = relations(integrationEnv, ({ one }) => ({
  integration: one(integrations, {
    fields: [integrationEnv.integrationId],
    references: [integrations.id],
  }),
}));
