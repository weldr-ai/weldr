import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { flows } from "./flows";
import { primitives } from "./primitives";

export const edges = pgTable("edges", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  source: text("source")
    .references(() => primitives.id, { onDelete: "cascade" })
    .notNull(),
  target: text("target")
    .references(() => primitives.id, { onDelete: "cascade" })
    .notNull(),
  flowId: text("flow_id")
    .references(() => flows.id, { onDelete: "cascade" })
    .notNull(),
});

export const edgesRelations = relations(edges, ({ many, one }) => ({
  primitives: many(primitives),
  flows: one(flows, {
    fields: [edges.flowId],
    references: [flows.id],
  }),
}));

// Zod schemas
export const edgeSchema = createSelectSchema(edges);
export const insertEdgeSchema = createInsertSchema(edges, {
  id: (schema) => schema.id.cuid2(),
  source: (schema) => schema.source.cuid2(),
  target: (schema) => schema.target.cuid2(),
});
