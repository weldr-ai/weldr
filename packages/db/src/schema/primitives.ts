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

import type { PrimitiveMetadata } from "../types";
import { users } from "./auth";
import { flows } from "./flows";
import { resourceProviders } from "./resources";

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
  createdBy: text("created_by")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
});

export const primitivesRelations = relations(primitives, ({ one }) => ({
  flow: one(flows, {
    fields: [primitives.flowId],
    references: [flows.id],
  }),
  user: one(users, {
    fields: [primitives.createdBy],
    references: [users.id],
  }),
}));

// Zod schemas
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

export const insertPrimitiveSchema = createInsertSchema(primitives, {
  type: z.enum(primitiveTypes.enumValues),
}).pick({
  id: true,
  name: true,
  description: true,
  type: true,
  flowId: true,
  positionX: true,
  positionY: true,
  metadata: true,
});

export const updateFunctionSchema = z.object({
  type: z.literal("function"),
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

export const updateRouteSchema = z.object({
  type: z.literal("route"),
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

export const updateWorkflowSchema = z.object({
  type: z.literal("workflow"),
  triggerType: z.enum(["webhook", "schedule"]).optional(),
});

export const updatePrimitiveMetadataSchema = z.discriminatedUnion("type", [
  updateFunctionSchema,
  updateRouteSchema,
  updateWorkflowSchema,
]);

export const updatePrimitiveSchema = z.object({
  where: z.object({
    id: z.string(),
    type: z.enum(primitiveTypes.enumValues).optional(),
  }),
  payload: z.object({
    name: z
      .string()
      .min(1, {
        message: "Name is required.",
      })
      .transform((name) => name.replace(/\s+/g, " ").trim())
      .optional(),
    description: z.string().optional(),
    positionX: z.number().optional(),
    positionY: z.number().optional(),
    metadata: updatePrimitiveMetadataSchema.optional(),
  }),
});
