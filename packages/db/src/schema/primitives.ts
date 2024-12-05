import type {
  Dependency,
  InputSchema,
  OutputSchema,
  RawContent,
  Resource,
} from "@integramind/shared/types";
import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { conversations } from "./conversations";
import { edges } from "./edges";
import { flows } from "./flows";
import { testRuns } from "./test-runs";

export const primitives = pgTable(
  "primitives",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name"),
    positionX: integer("position_x"),
    positionY: integer("position_y"),
    inputSchema: jsonb("input_schema").$type<InputSchema>(),
    outputSchema: jsonb("output_schema").$type<OutputSchema>(),
    testInput: jsonb("test_input").$type<unknown>(),
    description: text("description"),
    rawDescription: jsonb("raw_description").$type<RawContent>(),
    code: text("code"),
    logicalSteps: jsonb("logical_steps").$type<RawContent>(),
    edgeCases: text("edge_cases"),
    errorHandling: text("error_handling"),
    resources: jsonb("resources").$type<Resource[]>().array(),
    dependencies: jsonb("dependencies").$type<Dependency[]>().array(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .references(() => users.id, {
        onDelete: "set null",
      })
      .default(sql`NULL`),
    conversationId: text("conversation_id").notNull(),
    flowId: text("flow_id")
      .references(() => flows.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => ({
    uniqueName: uniqueIndex("unique_name").on(t.name, t.flowId),
  }),
);

export const primitivesRelations = relations(primitives, ({ one, many }) => ({
  flow: one(flows, {
    fields: [primitives.flowId],
    references: [flows.id],
  }),
  conversation: one(conversations, {
    fields: [primitives.conversationId],
    references: [conversations.id],
  }),
  testRuns: many(testRuns),
  user: one(users, {
    fields: [primitives.userId],
    references: [users.id],
  }),
  edges: many(edges),
}));
