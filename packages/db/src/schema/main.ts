import { relations } from "drizzle-orm";
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
    .$onUpdate(() => new Date())
    .notNull(),
});

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  compoundBlocks: many(compoundBlocks),
  workflows: many(workflows),
  accessPoints: many(accessPoints),
  resources: many(resources),
}));

export const compoundBlocks = pgTable("compound_blocks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  flow: jsonb("flow").$type<Flow>().default({ nodes: [], edges: [] }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => new Date())
    .notNull(),
  workspaceId: text("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
});

export const flowsRelations = relations(compoundBlocks, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [compoundBlocks.workspaceId],
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

export const actionBlockTypes = pgEnum("action_block_types", [
  "query",
  "action",
  "logical_data_processing",
  "ai_data_processing",
]);

export const actionBlocks = pgTable("action_blocks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description").notNull(),
  actionBlockType: actionBlockTypes("action_block_type"),
  metadata: jsonb("metadata").$type<{
    resourceId: string;
    inputs: Input[];
    outputs: Output[];
    generatedCode: string;
  }>(),
  codeNotUpdated: boolean("code_not_updated"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => new Date())
    .notNull(),
  workspaceId: text("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
});

/**
 * Zod Schemas
 */

export const blockTypes = z.enum([
  "access-point-block",
  "workflow-block",
  "query-block",
  "action-block",
  "logical-processing-block",
  "ai-processing-block",
  "logical-branch-block",
  "semantic-branch-block",
  "response-block",
]);

// workspaces schemas
export const workspaceSchema = createSelectSchema(workspaces);
export const insertWorkspaceSchema = createInsertSchema(workspaces, {
  name: (schema) =>
    schema.name.trim().min(1, {
      message: "Name is required.",
    }),
});

// Compound blocks schemas
export const compoundBlockSchema = createSelectSchema(compoundBlocks, {
  flow: z.object({
    nodes: z
      .object({
        id: z.string(),
        type: blockTypes,
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
export const insertCompoundBlockSchema = createInsertSchema(compoundBlocks, {
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
    nodes: z
      .object({
        id: z.string(),
        type: blockTypes,
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
    nodes: z
      .object({
        id: z.string(),
        type: blockTypes,
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

// Action blocks schemas
export const actionBlockSchema = createSelectSchema(actionBlocks);
export const insertActionBlockSchema = createInsertSchema(actionBlocks, {
  name: (schema) =>
    schema.name.trim().min(1, {
      message: "Name is required.",
    }),
});
