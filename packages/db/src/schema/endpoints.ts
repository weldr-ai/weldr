import type { OpenApiEndpointSpec } from "@integramind/shared/types";
import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  index,
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
import { dependencies } from "./dependencies";
import { funcs } from "./funcs";
import { endpointPackages } from "./packages";
import { projects } from "./projects";
import { endpointResources } from "./resources";

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
    code: text("code"),
    diff: text("diff"),
    openApiSpec: jsonb("open_api_spec").$type<OpenApiEndpointSpec>(),
    positionX: integer("position_x").default(0),
    positionY: integer("position_y").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    isDeleted: boolean("is_deleted").default(false),
    isDeployed: boolean("is_deployed").default(false),
    conversationId: text("conversation_id")
      .references(() => conversations.id)
      .notNull(),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    projectId: text("project_id")
      .references(() => projects.id)
      .notNull(),
    parentId: text("parent_id").references((): AnyPgColumn => endpoints.id),
  },
  (table) => ({
    uniqueEndpoint: unique().on(table.projectId, table.path, table.method),
    createdAtIdx: index("endpoints_created_at_idx").on(table.createdAt),
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
  funcDependencies: many(dependencies, {
    relationName: "dependency_endpoint",
  }),
  resources: many(endpointResources),
  packages: many(endpointPackages),
  parent: one(endpoints, {
    fields: [endpoints.parentId],
    references: [endpoints.id],
  }),
}));
