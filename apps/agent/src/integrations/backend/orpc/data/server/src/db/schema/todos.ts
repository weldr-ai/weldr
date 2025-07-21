import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { nanoid } from "@repo/server/lib/nanoid";
import { users } from "./auth";

export const todos = pgTable("todos", {
  id: text("id").$defaultFn(nanoid).primaryKey(),
  text: text("text").notNull(),
  completed: boolean("completed").default(false).notNull(),
  userId: text("user_id")
    .references(() => users.id, {
      onDelete: "cascade",
    })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
