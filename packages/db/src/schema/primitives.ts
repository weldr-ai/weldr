import type { PrimitiveMetadata } from "@integramind/shared/types";
import { createId } from "@paralleldrive/cuid2";
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
import { flows } from "./flows";

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
}));
