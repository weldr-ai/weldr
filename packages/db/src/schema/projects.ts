import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import {
  type AnyPgColumn,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import type { ProjectConfig } from "@weldr/shared/types";
import { users } from "./auth";
import { chats } from "./chats";
import { environmentVariables } from "./environment-variables";
import { integrations } from "./integrations";
import { versions } from "./versions";

export const projects = pgTable(
  "projects",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name"),
    subdomain: text("subdomain").unique().notNull(),
    config: jsonb("config").$type<ProjectConfig>(),
    initiatedAt: timestamp("initiated_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    mainDatabaseId: text("main_database_id").references(
      (): AnyPgColumn => integrations.id,
      {
        onDelete: "cascade",
      },
    ),
  },
  (t) => ({
    createdAtIdx: index("projects_created_at_idx").on(t.createdAt),
  }),
);

export const projectRelations = relations(projects, ({ many, one }) => ({
  environmentVariables: many(environmentVariables),
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  versions: many(versions),
  chats: many(chats),
  integrations: many(integrations),
  mainDatabase: one(integrations, {
    fields: [projects.mainDatabaseId],
    references: [integrations.id],
  }),
}));
