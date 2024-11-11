import type { PrimitiveMetadata } from "@integramind/shared/types";
import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { conversations } from "./conversations";
import { flows } from "./flows";

export const primitiveTypes = pgEnum("primitive_types", ["function", "stop"]);

export const primitives = pgTable(
  "primitives",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    type: primitiveTypes("type").notNull(),
    name: text("name"),
    metadata: jsonb("metadata").$type<PrimitiveMetadata>(),
    positionX: integer("position_x").default(0).notNull(),
    positionY: integer("position_y").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    flowId: text("flow_id")
      .references(() => flows.id, { onDelete: "cascade" })
      .notNull(),
    createdBy: text("created_by")
      .references(() => users.id, {
        onDelete: "set null",
      })
      .default(sql`NULL`),
    conversationId: text("conversation_id")
      .references(() => conversations.id, { onDelete: "cascade" })
      .default(sql`NULL`),
  },
  (t) => ({
    uniqueNameInFlow: unique().on(t.name, t.flowId),
  }),
);

export const primitivesRelations = relations(primitives, ({ one, many }) => ({
  flow: one(flows, {
    fields: [primitives.flowId],
    references: [flows.id],
  }),
  user: one(users, {
    fields: [primitives.createdBy],
    references: [users.id],
  }),
  conversation: one(conversations, {
    fields: [primitives.conversationId],
    references: [conversations.id],
  }),
  testRuns: many(testRuns),
}));

export const testRunStatus = pgEnum("test_run_status", ["success", "error"]);

export const testRuns = pgTable("test_runs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  input: jsonb("input").$type<Record<string, unknown>>(),
  output: jsonb("output").$type<Record<string, unknown>>(),
  status: testRunStatus("status").default("success"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  primitiveId: text("primitive_id")
    .references(() => primitives.id, { onDelete: "cascade" })
    .notNull(),
});

export const testRunsRelations = relations(testRuns, ({ one }) => ({
  primitive: one(primitives, {
    fields: [testRuns.primitiveId],
    references: [primitives.id],
  }),
}));
