import { relations } from "drizzle-orm";
import { jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import type { FlowEdge, PrimitiveMetadata } from "../types";

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
  resources: many(resources),
  flows: many(flows),
}));

export const flowTypes = pgEnum("flow_types", [
  "component",
  "workflow",
  "route",
]);

export const flows = pgTable("flows", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  type: flowTypes("type").notNull(),
  primitives: jsonb("primitives")
    .$type<PrimitiveMetadata[]>()
    .default([])
    .notNull(),
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

/**
 * Zod Schemas
 */

// Workspaces schemas
export const workspaceSchema = createSelectSchema(workspaces);
export const insertWorkspaceSchema = createInsertSchema(workspaces, {
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

// Flows schemas
export const flowTypesSchema = z.enum(flowTypes.enumValues);

export const flowSchema = createSelectSchema(flows, {
  primitives: z
    .discriminatedUnion("type", [
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        type: z.literal("function"),
        inputs: z
          .object({ name: z.string(), type: z.enum(["number", "text"]) })
          .array(),
        outputs: z
          .object({ name: z.string(), type: z.enum(["number", "text"]) })
          .array(),
        generatedCode: z.string(),
        isCodeUpdated: z.boolean(),
      }),
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        type: z.literal("route"),
        actionType: z.enum(["retrieve", "submit", "modify", "delete"]),
        urlPath: z.string(),
      }),
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        type: z.literal("workflow"),
        triggerType: z.enum(["webhook", "schedule"]),
      }),
    ])
    .array(),
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
    name: z.string().min(1, {
      message: "Name is required.",
    }),
    description: z.string(),
    workspaceId: z.string(),
    type: z.literal("component", {
      message: "Type is required.",
    }),
  }),
  z.object({
    name: z.string().min(1, {
      message: "Name is required.",
    }),
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
    name: z.string().min(1, {
      message: "Name is required.",
    }),
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
