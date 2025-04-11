import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { chats } from "./chats";
import { declarations } from "./declarations";

export const canvasNodeTypes = pgEnum("canvas_node_types", [
  "preview",
  "declaration",
]);

export const canvasNodes = pgTable(
  "canvas_nodes",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey()
      .notNull(),
    type: canvasNodeTypes("type").notNull(),
    position: jsonb("position").$type<{ x: number; y: number }>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => ({
    createdAtIdx: index("canvas_nodes_created_at_idx").on(t.createdAt),
  }),
);

export const canvasNodeRelations = relations(canvasNodes, ({ many }) => ({
  declarations: many(declarations),
  chats: many(chats),
}));
