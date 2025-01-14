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
import { endpointDefinitions } from "./endpoints";
import { funcDefinitions } from "./funcs";

export const primitiveType = pgEnum("primitive_type", ["function", "endpoint"]);

export const dependencies = pgTable(
  "dependencies",
  {
    dependentType: primitiveType("dependent_type").notNull(),
    dependentDefinitionId: text("dependent_definition_id").notNull(),
    dependencyType: primitiveType("dependency_type").notNull(),
    dependencyDefinitionId: text("dependency_definition_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({
      columns: [
        t.dependentType,
        t.dependentDefinitionId,
        t.dependencyType,
        t.dependencyDefinitionId,
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
  dependentFuncDefinition: one(funcDefinitions, {
    relationName: "dependent_func_definition",
    fields: [dependencies.dependentDefinitionId],
    references: [funcDefinitions.id],
  }),
  dependencyFuncDefinition: one(funcDefinitions, {
    relationName: "dependency_func_definition",
    fields: [dependencies.dependencyDefinitionId],
    references: [funcDefinitions.id],
  }),
  dependentEndpointDefinition: one(endpointDefinitions, {
    relationName: "dependent_endpoint_definition",
    fields: [dependencies.dependentDefinitionId],
    references: [endpointDefinitions.id],
  }),
  dependencyEndpointDefinition: one(endpointDefinitions, {
    relationName: "dependency_endpoint_definition",
    fields: [dependencies.dependencyDefinitionId],
    references: [endpointDefinitions.id],
  }),
}));
