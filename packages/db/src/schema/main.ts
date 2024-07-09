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
  resources: many(resources),
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

export const resourceProviders = pgEnum("resource_providers", ["postgres"]);

export const resources = pgTable("resources", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  description: text("description"),
  provider: resourceProviders("provider").notNull(),
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

export const resourcesRelations = relations(resources, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [resources.workspaceId],
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

// resources zod schemas
export const resourceProvidersSchema = z.enum(resourceProviders.enumValues);
export const insertResourceSchema = z.discriminatedUnion("provider", [
  z.object({
    name: z
      .string()
      .min(1, {
        message: "Name is required.",
      })
      .transform((name) => name.replace(/\s+/g, " ").trim()),
    description: z.string(),
    provider: z.literal("postgres"),
    host: z.string(),
    port: z.string().transform((port) => Number(port)),
    user: z.string(),
    password: z.string(),
    database: z.string(),
    workspaceId: z.string(),
  }),
]);
export const postgresMetadataSchema = z.object({
  provider: z.literal("postgres"),
  host: z.string(),
  port: z.number(),
  user: z.string(),
  password: z.string(),
  database: z.string(),
});
export const resourceMetadataSchema = z.discriminatedUnion("provider", [
  postgresMetadataSchema,
]);
export const resourceSchema = createSelectSchema(resources, {
  metadata: resourceMetadataSchema,
});

// Edges zod schemas
export const edgeSchema = createSelectSchema(edges);
export const insertEdgeSchema = createInsertSchema(edges, {
  id: (schema) => schema.id.cuid2(),
  source: (schema) => schema.source.cuid2(),
  target: (schema) => schema.target.cuid2(),
});

// Primitives zod schemas
export const functionRawDescriptionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    value: z.string(),
  }),
  z.object({
    type: z.literal("reference"),
    id: z.string(),
    referenceType: z.enum([
      "input",
      "database",
      "database-table",
      "database-column",
    ]),
    name: z.string(),
    icon: z.enum([
      "database-icon",
      "number-icon",
      "text-icon",
      "value-icon",
      "database-column-icon",
      "database-table-icon",
    ]),
    dataType: z.enum(["text", "number", "functionResponse"]).optional(),
    testValue: z
      .union([z.string(), z.number()])
      .nullable()
      .optional()
      .default(null),
  }),
]);

export const functionMetadataSchema = z.object({
  type: z.literal("function"),
  inputs: z
    .object({
      id: z.string(),
      name: z.string(),
      type: z.enum(["number", "text"]),
      testValue: z
        .union([z.string(), z.number()])
        .nullable()
        .optional()
        .default(null),
    })
    .array(),
  outputs: z
    .object({
      id: z.string(),
      name: z.string(),
      type: z.enum(["number", "text"]),
    })
    .array(),
  resource: z
    .object({
      id: z.string(),
      provider: z.enum(resourceProviders.enumValues),
    })
    .nullable()
    .optional(),
  rawDescription: functionRawDescriptionSchema.array().optional(),
  generatedCode: z.string().nullable().optional(),
  isCodeUpdated: z.boolean().default(false).optional(),
  isLocked: z.boolean().default(false).optional(),
});
export const routeMetadataSchema = z.object({
  type: z.literal("route"),
  actionType: z.enum(["create", "read", "update", "delete"]),
  urlPath: z.string(),
  inputs: z
    .object({
      id: z.string(),
      name: z.string(),
      testValue: z
        .union([z.string(), z.number()])
        .nullable()
        .optional()
        .default(null),
      type: z.enum(["number", "text"]),
    })
    .array(),
});
export const workflowMetadataSchema = z.object({
  type: z.literal("workflow"),
  triggerType: z.enum(["webhook", "schedule"]),
  inputs: z
    .object({
      id: z.string(),
      name: z.string(),
      testValue: z
        .union([z.string(), z.number()])
        .nullable()
        .optional()
        .default(null),
      type: z.enum(["number", "text"]),
    })
    .array(),
});
export const responseMetadataSchema = z.object({
  type: z.literal("response"),
  name: z.string(),
  description: z.string().optional(),
  inputs: z
    .object({
      id: z.string(),
      name: z.string(),
      testValue: z
        .union([z.string(), z.number()])
        .nullable()
        .optional()
        .default(null),
      type: z.enum(["number", "text"]),
    })
    .array(),
});
export const primitiveMetadataSchema = z.discriminatedUnion("type", [
  functionMetadataSchema,
  routeMetadataSchema,
  workflowMetadataSchema,
  responseMetadataSchema,
]);
export const primitiveTypesSchema = z.enum(primitiveTypes.enumValues);
export const primitiveSchema = createSelectSchema(primitives, {
  metadata: primitiveMetadataSchema,
});

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
    type: z.literal("component", {
      message: "Type is required.",
    }),
    workspaceId: z.string(),
  }),
  z.object({
    name: z
      .string()
      .min(1, {
        message: "Name is required.",
      })
      .transform((name) => name.replace(/\s+/g, " ").trim()),
    description: z.string(),
    type: z.literal("route", {
      message: "Type is required.",
    }),
    actionType: z.enum(["create", "read", "update", "delete"], {
      message: "Type is required.",
    }),
    urlPath: z.string().min(1, {
      message: "URL path is required.",
    }),
    workspaceId: z.string(),
  }),
  z.object({
    name: z
      .string()
      .min(1, {
        message: "Name is required.",
      })
      .transform((name) => name.replace(/\s+/g, " ").trim()),
    description: z.string(),
    type: z.literal("workflow", {
      message: "Type is required.",
    }),
    triggerType: z.enum(["webhook", "schedule"], {
      message: "Type is required.",
    }),
    workspaceId: z.string(),
  }),
]);

export const updateRouteFlowSchema = z.object({
  name: z
    .string()
    .min(1, {
      message: "Name is required.",
    })
    .transform((name) => name.replace(/\s+/g, " ").trim())
    .optional(),
  description: z.string().optional(),
  actionType: z.enum(["create", "read", "update", "delete"]).optional(),
  urlPath: z.string().optional(),
  inputs: z
    .object({
      id: z.string(),
      name: z.string(),
      testValue: z
        .union([z.string(), z.number()])
        .nullable()
        .optional()
        .default(null),
      type: z.enum(["number", "text", "functionResponse"]),
    })
    .array()
    .optional(),
});

export const updateFunctionSchema = z.object({
  name: z
    .string()
    .min(1, {
      message: "Name is required.",
    })
    .transform((name) => name.replace(/\s+/g, " ").trim())
    .optional(),
  description: z.string().optional(),
  inputs: z
    .object({
      id: z.string(),
      name: z.string(),
      testValue: z
        .union([z.string(), z.number()])
        .nullable()
        .optional()
        .default(null),
      type: z.enum(["number", "text", "functionResponse"]),
    })
    .array()
    .optional(),
  outputs: z
    .object({
      name: z.string(),
      type: z.enum(["number", "text", "functionResponse"]),
    })
    .array()
    .optional(),
  resource: z
    .object({
      id: z.string(),
      provider: z.enum(resourceProviders.enumValues),
    })
    .nullable()
    .optional(),
  rawDescription: functionRawDescriptionSchema.array().optional(),
  generatedCode: z.string().nullable().optional(),
  isCodeUpdated: z.boolean().optional(),
  isLocked: z.boolean().default(false).optional(),
});
