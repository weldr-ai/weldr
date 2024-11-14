import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { secrets } from "./vault";
import { workspaces } from "./workspaces";

export const environmentVariables = pgTable("environment_variables", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  key: text("key").notNull(),
  secretId: uuid("secret_id")
    .references(() => secrets.id, { onDelete: "cascade" })
    .notNull(),
  viewable: boolean("viewable").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  workspaceId: text("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
  createdBy: text("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
});

export const environmentVariablesRelations = relations(
  environmentVariables,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [environmentVariables.workspaceId],
      references: [workspaces.id],
    }),
    createdBy: one(users, {
      fields: [environmentVariables.createdBy],
      references: [users.id],
    }),
  }),
);
