import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import {
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import type { ResourceMetadata } from "@specly/shared/types";
import { users } from "./auth";
import { workspaces } from "./workspaces";

export const resourceProviders = pgEnum("resource_providers", [
  "postgres",
  "mysql",
]);

export const resources = pgTable(
  "resources",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name").notNull(),
    description: text("description"),
    provider: resourceProviders("provider").notNull(),
    metadata: jsonb("metadata").$type<ResourceMetadata>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    workspaceId: text("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    createdBy: text("created_by")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => ({
    uniqueNameInWorkspace: unique().on(t.name, t.workspaceId),
  }),
);

export const resourcesRelations = relations(resources, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [resources.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [resources.createdBy],
    references: [users.id],
  }),
}));
