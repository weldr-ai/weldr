import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { pgEnum, pgTable, primaryKey, text, unique } from "drizzle-orm/pg-core";
import { endpoints } from "./endpoints";
import { funcs } from "./funcs";
import { projects } from "./projects";

export const packageType = pgEnum("package_type", [
  "production",
  "development",
]);

export const packages = pgTable(
  "packages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    type: packageType("type").notNull(),
    name: text("name").notNull(),
    reason: text("reason").notNull(),
    version: text("version"),
    projectId: text("project_id").references(() => projects.id),
  },
  (t) => ({
    unique: unique().on(t.projectId, t.name),
  }),
);

export const packageRelations = relations(packages, ({ one, many }) => ({
  project: one(projects, {
    fields: [packages.projectId],
    references: [projects.id],
  }),
  endpoints: many(endpoints),
  funcs: many(funcs),
}));

export const funcPackages = pgTable(
  "func_packages",
  {
    funcId: text("func_id")
      .references(() => funcs.id, { onDelete: "cascade" })
      .notNull(),
    packageId: text("package_id")
      .references(() => packages.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.funcId, t.packageId] }),
  }),
);

export const funcPackagesRelations = relations(funcPackages, ({ one }) => ({
  func: one(funcs, {
    fields: [funcPackages.funcId],
    references: [funcs.id],
  }),
  package: one(packages, {
    fields: [funcPackages.packageId],
    references: [packages.id],
  }),
}));

export const endpointPackages = pgTable(
  "endpoint_packages",
  {
    packageId: text("package_id")
      .references(() => packages.id, { onDelete: "cascade" })
      .notNull(),
    endpointId: text("endpoint_id")
      .references(() => endpoints.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.packageId, t.endpointId] }),
  }),
);

export const endpointPackagesRelations = relations(
  endpointPackages,
  ({ one }) => ({
    package: one(packages, {
      fields: [endpointPackages.packageId],
      references: [packages.id],
    }),
    endpoint: one(endpoints, {
      fields: [endpointPackages.endpointId],
      references: [endpoints.id],
    }),
  }),
);
