import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { declarations } from "./declarations";
import { declarationTypes } from "./shared-enums";

export const dependencies = pgTable(
  "dependencies",
  {
    dependentType: declarationTypes("dependent_type").notNull(),
    dependentId: text("dependent_id")
      .references(() => declarations.id, { onDelete: "cascade" })
      .notNull(),
    dependencyType: declarationTypes("dependency_type").notNull(),
    dependencyId: text("dependency_id")
      .references(() => declarations.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.dependentId, t.dependencyId],
    }),
    index("dependencies_created_at_idx").on(t.createdAt),
    check("no_self_dep", sql`dependent_id != dependency_id`),
    // validDep: check(
    //   "valid_dep_types",
    //   sql`
    //     -- Function -> Function
    //     dependency_type = 'function' AND dependent_type = 'function' OR
    //     -- Function -> Endpoint
    //     dependency_type = 'function' AND dependent_type = 'endpoint' OR
    //     -- Function -> Component
    //     dependency_type = 'function' AND dependent_type = 'component' OR
    //     -- Component -> Function
    //     dependency_type = 'component' AND dependent_type = 'function' OR
    //     -- Component -> Endpoint
    //     dependency_type = 'component' AND dependent_type = 'endpoint' OR
    //     -- Component -> Component
    //     dependency_type = 'component' AND dependent_type = 'component'
    //   `,
    // ),
  ],
);

export const dependenciesRelations = relations(dependencies, ({ one }) => ({
  dependency: one(declarations, {
    relationName: "dependency_declaration",
    fields: [dependencies.dependencyId],
    references: [declarations.id],
  }),
  dependent: one(declarations, {
    relationName: "dependent_declaration",
    fields: [dependencies.dependentId],
    references: [declarations.id],
  }),
}));
