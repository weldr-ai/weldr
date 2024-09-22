import { createId } from "@paralleldrive/cuid2";
import type { PrimitiveMetadata, RawDescription } from "@specly/shared/types";
import { relations } from "drizzle-orm";
import {
  type AnyPgColumn,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { flows } from "./flows";

export const messageFrom = pgEnum("message_from", ["user", "ai"]);

export const functionChatMessages = pgTable("function_chat_messages", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  messageFrom: messageFrom("message_from").notNull(),
  message: text("message").notNull(),
  rawMessage: jsonb("raw_message").$type<RawDescription[]>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const functionPrimitive = pgTable("function_primitives", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  description: text("description"),
  rawDescription: jsonb("raw_description").$type<RawDescription[]>().notNull(),
  inputs: jsonb("inputs").$type<Record<string, string>>().notNull(),
  outputs: jsonb("outputs").$type<Record<string, string>>().notNull(),
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
});

export const primitiveTypes = pgEnum("primitive_types", [
  "route",
  "workflow",
  "function",
  "matcher",
  "iterator",
  "response",
]);

export const primitives = pgTable(
  "primitives",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name"),
    description: text("description"),
    type: primitiveTypes("type").notNull(),
    positionX: integer("position_x").default(0).notNull(),
    positionY: integer("position_y").default(0).notNull(),
    metadata: jsonb("metadata").$type<PrimitiveMetadata>().notNull(),
    parentId: text("parent_id").references((): AnyPgColumn => primitives.id, {
      onDelete: "cascade",
    }),
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

export const primitivesRelations = relations(primitives, ({ one }) => ({
  flow: one(flows, {
    fields: [primitives.flowId],
    references: [flows.id],
  }),
  user: one(users, {
    fields: [primitives.createdBy],
    references: [users.id],
  }),
  parent: one(primitives, {
    fields: [primitives.parentId],
    references: [primitives.id],
  }),
}));
