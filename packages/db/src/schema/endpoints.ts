import type {
  OpenApiEndpointSpec,
  Package,
  RequirementResource,
} from "@integramind/shared/types";
import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import {
  type AnyPgColumn,
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
import { conversationMessages, conversations } from "./conversations";
import { dependencies } from "./dependencies";
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
    currentVersionId: text("current_version_id").references(
      (): AnyPgColumn => endpointVersions.id,
    ),
  },
  (table) => ({
    uniqueEndpoint: unique().on(table.projectId, table.path, table.method),
    projectIdIdx: index("endpoints_project_id_idx").on(table.projectId),
    userIdIdx: index("endpoints_user_id_idx").on(table.userId),
    conversationIdIdx: index("endpoints_conversation_id_idx").on(
      table.conversationId,
    ),
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
  versions: many(endpointVersions),
  currentVersion: one(endpointVersions, {
    fields: [endpoints.currentVersionId],
    references: [endpointVersions.id],
  }),
}));

export const endpointVersions = pgTable(
  "endpoint_versions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    versionTitle: text("version_title").notNull(),
    versionNumber: integer("version_number").notNull(),
    code: text("code"),
    openApiSpec: jsonb("open_api_spec").$type<OpenApiEndpointSpec>(),
    resources: jsonb("resources").$type<RequirementResource[]>(),
    packages: jsonb("packages").$type<Package[]>(),
    hash: text("hash").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    endpointId: text("endpoint_id").references(() => endpoints.id, {
      onDelete: "cascade",
    }),
    messageId: text("message_id")
      .references(() => conversationMessages.id)
      .notNull(),
  },
  (table) => ({
    endpointIdIdx: index("endpoint_versions_endpoint_id_idx").on(
      table.endpointId,
    ),
    userIdIdx: index("endpoint_versions_user_id_idx").on(table.userId),
    createdAtIdx: index("endpoint_versions_created_at_idx").on(table.createdAt),
  }),
);

export const endpointVersionsRelations = relations(
  endpointVersions,
  ({ one, many }) => ({
    endpoint: one(endpoints, {
      fields: [endpointVersions.endpointId],
      references: [endpoints.id],
    }),
    user: one(users, {
      fields: [endpointVersions.userId],
      references: [users.id],
    }),
    message: one(conversationMessages, {
      fields: [endpointVersions.messageId],
      references: [conversationMessages.id],
    }),
    dependents: many(dependencies, {
      relationName: "dependents",
    }),
    dependencies: many(dependencies, {
      relationName: "dependencies",
    }),
  }),
);
