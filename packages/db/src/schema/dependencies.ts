import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { endpoints } from "./endpoints";
import { funcs } from "./funcs";

export const primitiveType = pgEnum("primitive_type", ["function", "endpoint"]);

export const dependencies = pgTable(
  "dependencies",
  {
    dependentId: text("dependent_id").notNull(),
    dependentType: primitiveType("dependent_type").notNull(),
    dependencyId: text("dependency_id").notNull(),
    dependencyType: primitiveType("dependency_type").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({
      columns: [
        t.dependentId,
        t.dependentType,
        t.dependencyId,
        t.dependencyType,
      ],
    }),
    createdAtIdx: index("dependencies_created_at_idx").on(t.createdAt),
    noSelfDep: check("no_self_dep", sql`dependent_id != dependency_id`),
    validDep: check(
      "valid_dep_types",
      sql`
        -- Allow:
        -- 1. Function -> Function
        -- 2. Endpoint -> Function
        -- Prevent:
        -- 1. Function -> Endpoint
        -- 2. Endpoint -> Endpoint
        dependency_type = 'function' AND
        (dependent_type = 'function' OR dependent_type = 'endpoint')
      `,
    ),
  }),
);

export const dependenciesRelations = relations(dependencies, ({ one }) => ({
  dependentFunc: one(funcs, {
    relationName: "dependent_func",
    fields: [dependencies.dependentId],
    references: [funcs.id],
  }),
  dependencyFunc: one(funcs, {
    relationName: "dependency_func",
    fields: [dependencies.dependencyId],
    references: [funcs.id],
  }),
  dependentEndpoint: one(endpoints, {
    relationName: "dependent_endpoint",
    fields: [dependencies.dependentId],
    references: [endpoints.id],
  }),
  dependencyEndpoint: one(endpoints, {
    relationName: "dependency_endpoint",
    fields: [dependencies.dependencyId],
    references: [endpoints.id],
  }),
}));
