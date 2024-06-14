import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import type { PrimitiveMetadata, ResourceMetadata } from "../types";

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
  dataResources: many(dataResources),
  flows: many(flows),
}));

export const primitiveTypes = pgEnum("primitive_types", [
  "route",
  "workflow",
  "function",
  "conditional-branch",
  "iterator",
  "response",
]);

export const primitives = pgTable("primitives", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  description: text("description"),
  type: primitiveTypes("type").notNull(),
  positionX: integer("position_x").default(0).notNull(),
  positionY: integer("position_y").default(0).notNull(),
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

export const edges = pgTable("edges", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  source: text("source")
    .references(() => primitives.id, { onDelete: "cascade" })
    .notNull(),
  target: text("target")
    .references(() => primitives.id, { onDelete: "cascade" })
    .notNull(),
  flow_id: text("flow_id")
    .references(() => flows.id, { onDelete: "cascade" })
    .notNull(),
});

export const edgesRelations = relations(edges, ({ many, one }) => ({
  primitives: many(primitives),
  flows: one(flows, {
    fields: [edges.flow_id],
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
  edges: many(edges),
}));

export const dataResourceProviders = pgEnum("data_resource_providers", [
  "postgres",
]);

export const dataResources = pgTable("data_resources", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  description: text("description"),
  provider: dataResourceProviders("provider").notNull(),
  metadata: jsonb("metadata").$type<ResourceMetadata>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  workspaceId: text("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
});

export const resourcesRelations = relations(dataResources, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [dataResources.workspaceId],
    references: [workspaces.id],
  }),
}));

/**
 * Zod Schemas
 */

// Workspaces zod schemas
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

// Data resources zod schemas
export const dataResourceProvidersSchema = z.enum(
  dataResourceProviders.enumValues,
);
export const dataResourceSchema = createSelectSchema(dataResources);
export const insertDataResourceSchema = z.discriminatedUnion("provider", [
  z.object({
    name: z
      .string()
      .min(1, {
        message: "Name is required.",
      })
      .transform((name) => name.replace(/\s+/g, " ").trim()),
    description: z.string(),
    provider: z.literal("postgres"),
    connectionString: z.string(),
    workspaceId: z.string(),
  }),
]);
export const postgresMetadataSchema = z.object({
  provider: z.literal("postgres"),
  connectionString: z.string(),
  tables: z
    .object({
      name: z.string(),
      columns: z.string().array(),
    })
    .array(),
});
export const dataResourceMetadataSchema = z.discriminatedUnion("provider", [
  postgresMetadataSchema,
]);

// Primitives zod schemas
export const primitiveTypesSchema = z.enum(primitiveTypes.enumValues);
export const primitiveSchema = createSelectSchema(primitives);
export const functionMetadataSchema = z.object({
  type: z.literal("function"),
  inputs: z
    .object({ name: z.string(), type: z.enum(["number", "text"]) })
    .array(),
  outputs: z
    .object({ name: z.string(), type: z.enum(["number", "text"]) })
    .array(),
  generatedCode: z.string().optional(),
  isCodeUpdated: z.boolean().optional(),
});
export const routeMetadataSchema = z.object({
  type: z.literal("route"),
  actionType: z.enum(["retrieve", "submit", "modify", "delete"]),
  urlPath: z.string(),
  inputs: z
    .object({ name: z.string(), type: z.enum(["number", "text"]) })
    .array(),
});
export const workflowMetadataSchema = z.object({
  type: z.literal("workflow"),
  triggerType: z.enum(["webhook", "schedule"]),
  inputs: z
    .object({ name: z.string(), type: z.enum(["number", "text"]) })
    .array(),
});

export const primitiveMetadataSchema = z.discriminatedUnion("type", [
  functionMetadataSchema,
  routeMetadataSchema,
  workflowMetadataSchema,
]);

// Flows zod schemas
export const flowTypesSchema = z.enum(flowTypes.enumValues);
export const flowSchema = createSelectSchema(flows);
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
