import { relations } from "drizzle-orm";

import { sql } from "drizzle-orm";
import { text, timestamp } from "drizzle-orm/pg-core";

import { jsonb } from "drizzle-orm/pg-core";

import { pgTable } from "drizzle-orm/pg-core";

import { createId } from "@paralleldrive/cuid2";
import { flows } from "./flows";
import { primitives } from "./primitives";

export const testRuns = pgTable("test_runs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  input: jsonb("input").$type<Record<string, unknown>>().default(sql`NULL`),
  stdout: text("stdout").default(sql`NULL`),
  stderr: text("stderr").default(sql`NULL`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  primitiveId: text("primitive_id").references(() => primitives.id, {
    onDelete: "cascade",
  }),
  flowId: text("flow_id").references(() => flows.id, { onDelete: "cascade" }),
});

export const testRunsRelations = relations(testRuns, ({ one }) => ({
  primitive: one(primitives, {
    fields: [testRuns.primitiveId],
    references: [primitives.id],
  }),
  flow: one(flows, {
    fields: [testRuns.flowId],
    references: [flows.id],
  }),
}));
