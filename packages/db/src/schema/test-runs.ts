import { relations } from "drizzle-orm";

import { sql } from "drizzle-orm";
import { text, timestamp } from "drizzle-orm/pg-core";

import { jsonb } from "drizzle-orm/pg-core";

import { pgTable } from "drizzle-orm/pg-core";

import { createId } from "@paralleldrive/cuid2";
import { flows } from "./flows";
import { funcs } from "./funcs";

export const testRuns = pgTable("test_runs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  input: jsonb("input").$type<Record<string, unknown>>().default(sql`NULL`),
  stdout: text("stdout").default(sql`NULL`),
  stderr: text("stderr").default(sql`NULL`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  funcId: text("func_id").references(() => funcs.id, {
    onDelete: "cascade",
  }),
  flowId: text("flow_id").references(() => flows.id, { onDelete: "cascade" }),
});

export const testRunsRelations = relations(testRuns, ({ one }) => ({
  func: one(funcs, {
    fields: [testRuns.funcId],
    references: [funcs.id],
  }),
  flow: one(flows, {
    fields: [testRuns.flowId],
    references: [flows.id],
  }),
}));
