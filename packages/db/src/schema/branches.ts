import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { nanoid } from "@weldr/shared/nanoid";

import { projects } from "./projects";
import { versions } from "./versions";

export const branches = pgTable(
  "branches",
  {
    id: text("id").primaryKey().$defaultFn(nanoid),
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    type: text("type")
      .$type<"variant" | "stream">()
      .notNull()
      .default("stream"),
    parentBranchId: text("parent_branch_id").references(
      (() => branches.id) as unknown as () => AnyPgColumn,
      { onDelete: "set null" },
    ),
    forkedFromVersionId: text("forked_from_version_id").references(
      (() => versions.id) as unknown as () => AnyPgColumn,
      { onDelete: "restrict" },
    ),
    forksetId: text("forkset_id"),
    headVersionId: text("head_version_id").references(
      (() => versions.id) as unknown as () => AnyPgColumn,
      { onDelete: "set null" },
    ),
    isMain: boolean("is_main").notNull().default(false),
    status: text("status")
      .$type<"active" | "archived">()
      .notNull()
      .default("active"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("branches_project_idx").on(t.projectId),
    index("branches_parent_fork_idx").on(
      t.parentBranchId,
      t.forkedFromVersionId,
    ),
    index("branches_forkset_idx").on(t.forksetId),
    index("branches_head_idx").on(t.headVersionId),
    // one main per project
    uniqueIndex("branches_one_main_per_project_uidx")
      .on(t.projectId)
      .where(sql`${t.isMain} = true`),
    // Main/root branch must NOT have a fork point
    check(
      "branches_main_no_fork_chk",
      sql`(NOT ${t.isMain} OR ${t.forkedFromVersionId} IS NULL)`,
    ),
    // Variants REQUIRE fork point and forkset
    check(
      "branches_variant_requirements_chk",
      sql`(${t.type} <> 'variant' OR (${t.forkedFromVersionId} IS NOT NULL AND ${t.forksetId} IS NOT NULL))`,
    ),
    // Streams must NOT have a forkset
    check(
      "branches_stream_no_forkset_chk",
      sql`(${t.type} <> 'stream' OR ${t.forksetId} IS NULL)`,
    ),
    // Non-main streams that have a parent MUST have a fork point
    check(
      "branches_stream_parent_requires_fork_chk",
      sql`(NOT (${t.type} = 'stream' AND ${t.isMain} = false AND ${t.parentBranchId} IS NOT NULL) OR ${t.forkedFromVersionId} IS NOT NULL)`,
    ),
  ],
);

export const branchesRelations = relations(branches, ({ one, many }) => ({
  project: one(projects, {
    fields: [branches.projectId],
    references: [projects.id],
  }),
  parent: one(branches, {
    fields: [branches.parentBranchId],
    references: [branches.id],
    relationName: "branch_parent",
  }),
  forkedFromVersion: one(versions, {
    fields: [branches.forkedFromVersionId],
    references: [versions.id],
  }),
  headVersion: one(versions, {
    fields: [branches.headVersionId],
    references: [versions.id],
  }),
  children: many(branches, { relationName: "branch_parent" }),
  versions: many(versions),
}));
