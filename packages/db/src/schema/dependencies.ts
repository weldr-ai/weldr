import { relations, sql } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { endpointVersions } from "./endpoints";
import { funcVersions } from "./funcs";

export const dependentType = pgEnum("dependent_type", ["function", "endpoint"]);

export const dependencies = pgTable(
  "dependencies",
  {
    dependentType: dependentType("dependent_type").notNull(),
    dependentVersionId: text("dependent_version_id")
      .references(() => funcVersions.id, {
        onDelete: "cascade",
      })
      .notNull(),
    dependencyVersionId: text("dependency_version_id").references(
      () => funcVersions.id,
      {
        onDelete: "set null",
      },
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqueDependency: uniqueIndex("unique_dependency").on(
      t.dependentType,
      t.dependentVersionId,
      t.dependencyVersionId,
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
    funcVersionIdx: index("func_version_idx").on(t.dependentVersionId),
    dependencyVersionIdx: index("dependency_version_idx").on(
      t.dependencyVersionId,
    ),
  }),
);

export const dependenciesRelations = relations(dependencies, ({ one }) => ({
  dependentFuncVersion: one(funcVersions, {
    relationName: "dependents",
    fields: [dependencies.dependentVersionId],
    references: [funcVersions.id],
  }),
  dependentEndpointVersion: one(endpointVersions, {
    relationName: "dependents",
    fields: [dependencies.dependentVersionId],
    references: [endpointVersions.id],
  }),
  dependencyVersion: one(funcVersions, {
    relationName: "dependencies",
    fields: [dependencies.dependencyVersionId],
    references: [funcVersions.id],
  }),
}));
