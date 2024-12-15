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
import { users } from "./auth";
import { workspaces } from "./workspaces";

export const httpMethods = pgEnum("http_methods", [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
]);

export const endpoints = pgTable(
  "endpoints",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name").notNull(),
    description: text("description"),
    httpMethod: httpMethods("http_method").notNull(),
    path: text("path").notNull(),
    routeHandler: text("route_handler"),
    openApiSpec: jsonb("open_api_spec"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    workspaceId: text("workspace_id")
      .references(() => workspaces.id)
      .notNull(),
  },
  (table) => ({
    uniqueEndpoint: unique().on(
      table.workspaceId,
      table.path,
      table.httpMethod,
    ),
  }),
);

export const endpointsRelations = relations(endpoints, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [endpoints.workspaceId],
    references: [workspaces.id],
  }),
}));
