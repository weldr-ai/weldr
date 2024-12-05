import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { flows } from "./flows";
import { primitives } from "./primitives";

export const dependencyType = pgEnum("dependency_type", [
  "consumes",
  "requires",
]);

export const edges = pgTable(
  "edges",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    type: dependencyType("type").notNull(),
    targetId: text("target_primitive_id")
      .references(() => primitives.id, { onDelete: "cascade" })
      .notNull(),
    localSourceId: text("local_source_id")
      .references(() => primitives.id, { onDelete: "cascade" })
      .default(sql`NULL`),
    importedSourceId: text("imported_source_id")
      .references(() => flows.id, { onDelete: "cascade" })
      .default(sql`NULL`),
    flowId: text("flow_id")
      .references(() => flows.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqueDependency: uniqueIndex("unique_dependency").on(
      t.targetId,
      t.localSourceId,
      t.importedSourceId,
    ),
  }),
);

export const edgesRelations = relations(edges, ({ one }) => ({
  target: one(primitives, {
    fields: [edges.targetId],
    references: [primitives.id],
  }),
  localSource: one(primitives, {
    fields: [edges.localSourceId],
    references: [primitives.id],
  }),
  importedSource: one(flows, {
    relationName: "importedSource",
    fields: [edges.importedSourceId],
    references: [flows.id],
  }),
  flow: one(flows, {
    relationName: "flow",
    fields: [edges.flowId],
    references: [flows.id],
  }),
}));
