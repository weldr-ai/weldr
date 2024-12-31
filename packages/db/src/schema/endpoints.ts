import type {
  OpenApiEndpointSpec,
  Package,
  RequirementResource,
} from "@integramind/shared/types";
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
import { conversations } from "./conversations";
import { funcs } from "./funcs";
import { projects } from "./projects";

export const httpMethods = pgEnum("http_methods", [
  "get",
  "post",
  "put",
  "patch",
  "delete",
]);

export const endpoints = pgTable(
  "endpoints",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    path: text("path"),
    method: httpMethods("method"),
    summary: text("summary"),
    code: text("code"),
    openApiSpec: jsonb("open_api_spec").$type<OpenApiEndpointSpec>(),
    resources: jsonb("resources").$type<RequirementResource[]>(),
    packages: jsonb("packages").$type<Package[]>(),
    positionX: integer("position_x").default(0),
    positionY: integer("position_y").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    conversationId: text("conversation_id")
      .references(() => conversations.id)
      .notNull(),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    projectId: text("project_id")
      .references(() => projects.id)
      .notNull(),
  },
  (table) => ({
    uniqueEndpoint: unique().on(table.projectId, table.path, table.method),
  }),
);

export const endpointsRelations = relations(endpoints, ({ one, many }) => ({
  project: one(projects, {
    fields: [endpoints.projectId],
    references: [projects.id],
  }),
  conversation: one(conversations, {
    fields: [endpoints.conversationId],
    references: [conversations.id],
  }),
  funcs: many(funcs),
}));
