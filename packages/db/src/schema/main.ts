import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import type { FlowEdge, PrimitiveMetadata } from "../types";

// Tables

export const workspaces = pgTable("workspaces", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  resources: many(resources),
  flows: many(flows),
}));

export const primitiveTypes = pgEnum("primitive_types", [
  "route",
  "workflow",
  "function",
  "conditional-branch",
  "loop",
  "response",
]);

export const primitives = pgTable("primitives", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  description: text("description"),
  type: primitiveTypes("type").notNull(),
  metadata: jsonb("metadata").$type<PrimitiveMetadata>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  flowId: text("flow_id")
    .references(() => flows.id, { onDelete: "cascade" })
    .notNull(),
});

export const primitivesRelations = relations(primitives, ({ one }) => ({
  flow: one(flows, {
    fields: [primitives.flowId],
    references: [flows.id],
  }),
}));

export const flowTypes = pgEnum("flow_types", [
  "component",
  "workflow",
  "route",
]);

export const flows = pgTable("flows", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  description: text("description"),
  type: flowTypes("type").notNull(),
  edges: jsonb("edges").$type<FlowEdge[]>().default([]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  workspaceId: text("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
});

export const flowsRelations = relations(flows, ({ many }) => ({
  primitives: many(primitives),
}));

export const resources = pgTable("resources", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
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

/**
 * Zod Schemas
 */

// Workspaces schemas
export const workspaceSchema = createSelectSchema(workspaces);
export const insertWorkspaceSchema = createInsertSchema(workspaces, {
  name: (schema) =>
    schema.name
      .trim()
      .min(1, {
        message: "Name is required.",
      })
      .transform((name) => name.replace(/\s+/g, " ").trim()),
});

// Resources schemas
export const resourceSchema = createSelectSchema(resources);

export const insertResourceSchema = createInsertSchema(resources, {
  name: (schema) =>
    schema.name
      .trim()
      .min(1, {
        message: "Name is required.",
      })
      .transform((name) => name.replace(/\s+/g, " ").trim()),
});

// Primitives schemas
export const primitiveSchema = createSelectSchema(primitives);

// Flows schemas
export const flowTypesSchema = z.enum(flowTypes.enumValues);

export const flowSchema = createSelectSchema(flows, {
  edges: z
    .object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
    })
    .array(),
});

export const insertFlowSchema = z.discriminatedUnion("type", [
  z.object({
    name: z
      .string()
      .min(1, {
        message: "Name is required.",
      })
      .transform((name) => name.replace(/\s+/g, " ").trim()),
    description: z.string(),
    workspaceId: z.string(),
    type: z.literal("component", {
      message: "Type is required.",
    }),
  }),
  z.object({
    name: z
      .string()
      .min(1, {
        message: "Name is required.",
      })
      .transform((name) => name.replace(/\s+/g, " ").trim()),
    description: z.string(),
    workspaceId: z.string(),
    type: z.literal("route", {
      message: "Type is required.",
    }),
    actionType: z.enum(["retrieve", "submit", "modify", "delete"], {
      message: "Type is required.",
    }),
    urlPath: z.string().min(1, {
      message: "URL path is required.",
    }),
  }),
  z.object({
    name: z
      .string()
      .min(1, {
        message: "Name is required.",
      })
      .transform((name) => name.replace(/\s+/g, " ").trim()),
    description: z.string(),
    workspaceId: z.string(),
    type: z.literal("workflow", {
      message: "Type is required.",
    }),
    triggerType: z.enum(["webhook", "schedule"], {
      message: "Type is required.",
    }),
  }),
]);
