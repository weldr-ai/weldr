import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { pgEnum, pgTable, text, unique } from "drizzle-orm/pg-core";
import { projects } from "./projects";

export const packageType = pgEnum("package_type", ["runtime", "development"]);

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
}));
