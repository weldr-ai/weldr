import { createId } from "@paralleldrive/cuid2";
import type {
  FunctionMetadata,
  InputSchema,
  OutputSchema,
  RawDescription,
} from "@specly/shared/types";
import { relations } from "drizzle-orm";
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

export const primitiveTypes = pgEnum("primitive_types", [
  "function",
  "response",
]);

export const primitives = pgTable(
  "primitives",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    type: primitiveTypes("type").notNull(),
    name: text("name"),
    inputSchema: jsonb("input_schema").$type<InputSchema>(),
    outputSchema: jsonb("output_schema").$type<OutputSchema>(),
    description: text("description"),
    rawDescription: jsonb("raw_description").$type<RawDescription[]>(),
    generatedCode: text("generated_code"),
    metadata: jsonb("metadata").$type<FunctionMetadata>(),
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
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => ({
    uniqueName: unique().on(t.flowId, t.name),
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
  conversation: one(conversations),
}));
