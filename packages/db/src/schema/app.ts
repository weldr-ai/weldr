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

export const projects = pgTable("projects", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", {
    mode: "date",
    precision: 3,
  }).defaultNow(),
  updatedAt: timestamp("updated_at", {
    mode: "date",
    precision: 3,
  }).$onUpdate(() => new Date()),
});

export const projectsRelations = relations(projects, ({ many }) => ({
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
  flow: jsonb("flow").$type<Flow>().notNull(),
  createdAt: timestamp("created_at", {
    mode: "date",
    precision: 3,
  }).defaultNow(),
  updatedAt: timestamp("updated_at", {
    mode: "date",
    precision: 3,
  }).$onUpdate(() => new Date()),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
});

export const flowsRelations = relations(compoundBlocks, ({ one }) => ({
  author: one(projects, {
    fields: [compoundBlocks.projectId],
    references: [projects.id],
  }),
}));

export const triggerTypes = pgEnum("trigger_types", ["event", "time"]);

export const workflows = pgTable("workflows", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  triggerType: triggerTypes("trigger_type"),
  flow: jsonb("flow").$type<Flow>().notNull(),
  createdAt: timestamp("created_at", {
    mode: "date",
    precision: 3,
  }).defaultNow(),
  updatedAt: timestamp("updated_at", {
    mode: "date",
    precision: 3,
  }).$onUpdate(() => new Date()),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
});

export const workflowsRelations = relations(workflows, ({ one }) => ({
  author: one(projects, {
    fields: [workflows.projectId],
    references: [projects.id],
  }),
}));

export const actionTypes = pgEnum("action_types", [
  "retrieve",
  "submit",
  "modify",
  "delete",
]);

export const accessPoints = pgTable("access_point", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  actionType: actionTypes("action_type"),
  urlPath: text("url_path"),
  flow: jsonb("flow").$type<Flow>().notNull(),
  createdAt: timestamp("created_at", {
    mode: "date",
    precision: 3,
  }).defaultNow(),
  updatedAt: timestamp("updated_at", {
    mode: "date",
    precision: 3,
  }).$onUpdate(() => new Date()),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
});

export const accessPointsRelations = relations(accessPoints, ({ one }) => ({
  author: one(projects, {
    fields: [accessPoints.projectId],
    references: [projects.id],
  }),
}));

export const resources = pgTable("resources", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  provider: text("provider"),
  createdAt: timestamp("created_at", {
    mode: "date",
    precision: 3,
  }).defaultNow(),
  updatedAt: timestamp("updated_at", {
    mode: "date",
    precision: 3,
  }).$onUpdate(() => new Date()),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
});

export const resourcesRelations = relations(resources, ({ one }) => ({
  author: one(projects, {
    fields: [resources.projectId],
    references: [projects.id],
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
  createdAt: timestamp("created_at", {
    mode: "date",
    precision: 3,
  }).defaultNow(),
  updatedAt: timestamp("updated_at", {
    mode: "date",
    precision: 3,
  }).$onUpdate(() => new Date()),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
});

/**
 * Zod Schemas
 */

export const blockTypes = z.enum([
  "access-point-block",
  "workflow-trigger-block",
  "query-block",
  "action-block",
  "logical-processing-block",
  "ai-processing-block",
  "logical-branch-block",
  "semantic-branch-block",
  "response-block",
]);

// Projects schemas
export const projectSchema = createSelectSchema(projects);
export const insertProjectSchema = createInsertSchema(projects, {
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
