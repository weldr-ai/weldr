import { relations, sql } from "drizzle-orm";
import {
  boolean,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import type { Flow, Input, Output } from "../types";

// Tables

export const workspaces = pgTable("workspaces", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  components: many(components),
  workflows: many(workflows),
  accessPoints: many(accessPoints),
  resources: many(resources),
}));

export const components = pgTable("components", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  flow: jsonb("flow")
    .$type<Flow>()
    .default(sql`{ primitives: [], edges: [] }::jsonb`)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  workspaceId: text("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
});

export const flowsRelations = relations(components, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [components.workspaceId],
    references: [workspaces.id],
  }),
}));

export const triggerTypes = pgEnum("trigger_types", ["webhook", "schedule"]);

export const workflows = pgTable("workflows", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  triggerType: triggerTypes("trigger_type").notNull(),
  flow: jsonb("flow").$type<Flow>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  workspaceId: text("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
});

export const workflowsRelations = relations(workflows, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workflows.workspaceId],
    references: [workspaces.id],
  }),
}));

export const actionTypes = pgEnum("action_types", [
  "retrieve",
  "submit",
  "modify",
  "delete",
]);

export const accessPoints = pgTable("access_points", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  actionType: actionTypes("action_type").notNull(),
  urlPath: text("url_path").notNull(),
  flow: jsonb("flow").$type<Flow>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  workspaceId: text("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
});

export const accessPointsRelations = relations(accessPoints, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [accessPoints.workspaceId],
    references: [workspaces.id],
  }),
}));

export const resources = pgTable("resources", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  provider: text("provider"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  workspaceId: text("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
});

export const resourcesRelations = relations(resources, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [resources.workspaceId],
    references: [workspaces.id],
  }),
}));

export const functions = pgTable("functions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  inputs: jsonb("inputs").$type<Input[]>(),
  outputs: jsonb("outputs").$type<Output[]>(),
  generatedCode: text("generated_code"),
  isCodeUpdated: boolean("code_not_updated").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

/**
 * Zod Schemas
 */

export const primitiveTypes = z.enum([
  "access-point",
  "workflow",
  "function",
  "conditional-branch",
  "loop",
  "response",
]);

// workspaces schemas
export const workspaceSchema = createSelectSchema(workspaces);
export const insertWorkspaceSchema = createInsertSchema(workspaces, {
  name: (schema) =>
    schema.name.trim().min(1, {
      message: "Name is required.",
    }),
});

// Components schemas
export const componentSchema = createSelectSchema(components, {
  flow: z.object({
    primitives: z
      .object({
        id: z.string(),
        type: primitiveTypes,
      })
      .array(),
    edges: z
      .object({
        id: z.string(),
        source: z.string(),
        target: z.string(),
      })
      .array(),
  }),
});
export const insertComponentSchema = createInsertSchema(components, {
  name: (schema) =>
    schema.name.trim().min(1, {
      message: "Name is required.",
    }),
}).pick({
  name: true,
  description: true,
  workspaceId: true,
});

export const workflowSchema = createSelectSchema(workflows, {
  flow: z.object({
    primitives: z
      .object({
        id: z.string(),
        type: primitiveTypes,
      })
      .array(),
    edges: z
      .object({
        id: z.string(),
        source: z.string(),
        target: z.string(),
      })
      .array(),
  }),
});
export const insertWorkflowSchema = createInsertSchema(workflows, {
  name: (schema) =>
    schema.name.trim().min(1, {
      message: "Name is required.",
    }),
  triggerType: z.enum(triggerTypes.enumValues, {
    message: "Type is required.",
  }),
}).pick({
  name: true,
  description: true,
  triggerType: true,
  workspaceId: true,
});

// Access points schemas
export const accessPointSchema = createSelectSchema(accessPoints, {
  flow: z.object({
    primitives: z
      .object({
        id: z.string(),
        type: primitiveTypes,
      })
      .array(),
    edges: z
      .object({
        id: z.string(),
        source: z.string(),
        target: z.string(),
      })
      .array(),
  }),
});
export const insertAccessPointSchema = createInsertSchema(accessPoints, {
  name: (schema) =>
    schema.name.trim().min(1, {
      message: "Name is required.",
    }),
  actionType: z.enum(actionTypes.enumValues, {
    message: "Action type is required.",
  }),
  urlPath: (schema) =>
    schema.urlPath.trim().min(1, {
      message: "URL path is required.",
    }),
}).pick({
  name: true,
  description: true,
  actionType: true,
  urlPath: true,
  workspaceId: true,
});

// Resources schemas
export const resourceSchema = createSelectSchema(resources);
export const insertResourceSchema = createInsertSchema(resources, {
  name: (schema) =>
    schema.name.trim().min(1, {
      message: "Name is required.",
    }),
});
