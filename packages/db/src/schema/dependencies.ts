import { relations, sql } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { endpoints } from "./endpoints";
import { funcs } from "./funcs";

export const dependentType = pgEnum("dependent_type", ["function", "endpoint"]);

export const dependencies = pgTable(
  "dependencies",
  {
    dependentType: dependentType("dependent_type").notNull(),
    dependentId: text("dependent_id").notNull(),
    dependencyId: text("dependency_id")
      .references(() => funcs.id, {
        onDelete: "cascade",
      })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqueDependency: uniqueIndex("unique_dependency").on(
      t.dependentType,
      t.dependentId,
      t.dependencyId,
    ),
    // Only allow:
    // 1. Functions depending on different functions
    // 2. Endpoints depending on functions
    validDependencyRules: sql`check (
      CASE
        WHEN dependent_type = 'function' THEN
          dependent_id != dependency_id -- Prevent self-dependencies for functions
        WHEN dependent_type = 'endpoint' THEN
          true -- Endpoints can depend on any function
        ELSE
          false -- Reject any other cases
      END
    )`,
    funcIdx: index("func_idx").on(t.dependentId),
    dependencyIdx: index("dependency_idx").on(t.dependencyId),
  }),
);

export const dependenciesRelations = relations(dependencies, ({ one }) => ({
  dependentFunc: one(funcs, {
    relationName: "dependencies",
    fields: [dependencies.dependentId],
    references: [funcs.id],
  }),
  dependentEndpoint: one(endpoints, {
    relationName: "dependencies",
    fields: [dependencies.dependentId],
    references: [endpoints.id],
  }),
  dependency: one(funcs, {
    fields: [dependencies.dependencyId],
    references: [funcs.id],
  }),
}));
