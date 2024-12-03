import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { flows } from "./flows";
import { primitives } from "./primitives";

export const dependencies = pgTable(
  "dependencies",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    targetPrimitiveId: text("target_primitive_id")
      .references(() => primitives.id, { onDelete: "cascade" })
      .notNull(),
    sourcePrimitiveId: text("source_primitive_id")
      .references(() => primitives.id, { onDelete: "cascade" })
      .default(sql`NULL`),
    sourceUtilityId: text("source_utility_id")
      .references(() => flows.id, { onDelete: "cascade" })
      .default(sql`NULL`),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqueDependency: uniqueIndex("unique_dependency").on(
      t.targetPrimitiveId,
      t.sourcePrimitiveId,
      t.sourceUtilityId,
    ),
  }),
);

export const dependenciesRelations = relations(dependencies, ({ one }) => ({
  targetPrimitive: one(primitives, {
    fields: [dependencies.targetPrimitiveId],
    references: [primitives.id],
  }),
  sourcePrimitive: one(primitives, {
    fields: [dependencies.sourcePrimitiveId],
    references: [primitives.id],
  }),
  sourceUtility: one(flows, {
    fields: [dependencies.sourceUtilityId],
    references: [flows.id],
  }),
}));
