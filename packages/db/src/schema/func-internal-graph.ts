import { relations, sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { funcs } from "./funcs";

export const funcInternalGraph = pgTable("func_internal_graph", {
  funcId: text("func_id")
    .references(() => funcs.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
});

export const funcInternalGraphRelations = relations(
  funcInternalGraph,
  ({ one, many }) => ({
    func: one(funcs, {
      fields: [funcInternalGraph.funcId],
      references: [funcs.id],
    }),
    edges: many(funcInternalGraphEdges),
  }),
);

export const funcInternalGraphEdges = pgTable(
  "func_internal_graph_edges",
  {
    sourceFuncId: text("source_func_id")
      .references(() => funcs.id, { onDelete: "cascade" })
      .notNull(),
    targetFuncId: text("target_func_id")
      .references(() => funcs.id, { onDelete: "cascade" })
      .notNull(),
    connections: jsonb("connections")
      .$type<
        Array<{
          sourceOutput: string;
          targetInput: string;
        }>
      >()
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqueSourceTarget: uniqueIndex("unique_source_target").on(
      t.sourceFuncId,
      t.targetFuncId,
    ),
    noSelfConnections: sql`check (source_func_id != target_func_id)`,
    sourceIdx: index("internal_conn_source_idx").on(t.sourceFuncId),
    targetIdx: index("internal_conn_target_idx").on(t.targetFuncId),
  }),
);

export const funcInternalGraphEdgesRelations = relations(
  funcInternalGraphEdges,
  ({ one }) => ({
    sourceFunc: one(funcs, {
      fields: [funcInternalGraphEdges.sourceFuncId],
      references: [funcs.id],
    }),
    targetFunc: one(funcs, {
      fields: [funcInternalGraphEdges.targetFuncId],
      references: [funcs.id],
    }),
  }),
);
