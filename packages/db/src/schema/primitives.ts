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

export const roles = pgEnum("roles", ["user", "assistant"]);

export const chatMessages = pgTable("chat_messages", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  role: roles("message_from").notNull(),
  message: text("message").notNull(),
  rawMessage: jsonb("raw_message").$type<RawDescription[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  primitiveId: text("primitive_id")
    .references(() => primitives.id)
    .notNull(),
});

export const chatMessageRelations = relations(chatMessages, ({ one }) => ({
  primitive: one(primitives, {
    fields: [chatMessages.primitiveId],
    references: [primitives.id],
  }),
}));

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

export const primitivesRelations = relations(primitives, ({ one, many }) => ({
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
  chatMessages: many(chatMessages),
}));
