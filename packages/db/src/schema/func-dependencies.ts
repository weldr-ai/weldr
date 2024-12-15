import { relations, sql } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { funcs } from "./funcs";

export const funcDependencies = pgTable(
  "func_dependencies",
  {
    funcId: text("func_id")
      .references(() => funcs.id, { onDelete: "cascade" })
      .notNull(),
    dependencyFuncId: text("dependency_func_id")
      .references(() => funcs.id, {
        onDelete: "cascade",
      })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqueDependency: uniqueIndex("unique_dependency").on(
      t.funcId,
      t.dependencyFuncId,
    ),
    noSelfDeps: sql`check (func_id != dependency_func_id)`,
    funcIdx: index("func_idx").on(t.funcId),
    dependencyIdx: index("dependency_idx").on(t.dependencyFuncId),
  }),
);

export const funcDependenciesRelations = relations(
  funcDependencies,
  ({ one }) => ({
    func: one(funcs, {
      relationName: "funcDependencies",
      fields: [funcDependencies.funcId],
      references: [funcs.id],
    }),
    dependencyFunc: one(funcs, {
      fields: [funcDependencies.dependencyFuncId],
      references: [funcs.id],
    }),
  }),
);
