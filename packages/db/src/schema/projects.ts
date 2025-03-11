import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { chats } from "./chats";
import { environmentVariables } from "./environment-variables";

export const projects = pgTable(
  "projects",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name"),
    thumbnail: text("thumbnail"),
    subdomain: text("subdomain").unique().notNull(),
    ipAddressV6: text("ip_address_v6"),
    initiatedAt: timestamp("initiated_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => ({
    createdAtIdx: index("projects_created_at_idx").on(t.createdAt),
  }),
);

export const projectRelations = relations(projects, ({ many, one }) => ({
  environmentVariables: many(environmentVariables),
  chats: many(chats),
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
}));
