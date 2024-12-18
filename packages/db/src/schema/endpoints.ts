import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import {
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
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
  "delete",
  "patch",
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
    code: jsonb("code"),
    openApiSpec: jsonb("open_api_spec"),
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
    uniqueEndpoint: unique().on(table.projectId, table.path, table.httpMethod),
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

export const endpointFuncs = pgTable(
  "endpoint_funcs",
  {
    endpointId: text("endpoint_id")
      .references(() => endpoints.id)
      .notNull(),
    funcId: text("func_id")
      .references(() => funcs.id)
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.endpointId, table.funcId] }),
  }),
);
