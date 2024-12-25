import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { funcs } from "./funcs";

export const testRuns = pgTable("test_runs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  input: jsonb("input").$type<Record<string, unknown>>().default(sql`NULL`),
  stdout: text("stdout").default(sql`NULL`),
  stderr: text("stderr").default(sql`NULL`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  funcId: text("func_id")
    .references(() => funcs.id, {
      onDelete: "cascade",
    })
    .notNull(),
});

export const testRunsRelations = relations(testRuns, ({ one }) => ({
  func: one(funcs, {
    fields: [testRuns.funcId],
    references: [funcs.id],
  }),
}));
