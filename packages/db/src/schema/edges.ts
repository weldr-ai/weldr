import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import { pgTable, text } from "drizzle-orm/pg-core";

import { users } from "./auth";
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
  sourceHandle: text("source_handle"),
  targetHandle: text("target_handle"),
  flowId: text("flow_id")
    .references(() => flows.id, { onDelete: "cascade" })
    .notNull(),
  createdBy: text("created_by")
    .references(() => users.id, {
      onDelete: "set null",
    })
    .default(sql`NULL`),
});

export const edgesRelations = relations(edges, ({ many, one }) => ({
  primitives: many(primitives),
  flows: one(flows, {
    fields: [edges.flowId],
    references: [flows.id],
  }),
  user: one(users, {
    fields: [edges.createdBy],
    references: [users.id],
  }),
}));
