import { z } from "zod";
import { resourceProvidersSchema } from "./resources";

export const primitiveBaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().trim().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
  positionX: z.number(),
  positionY: z.number(),
  flowId: z.string(),
});

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

export const functionPrimitiveMetadataSchema = z.object({
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
    .array()
    .optional(),
  outputs: z
    .object({
      id: z.string(),
      name: z.string(),
      type: z.enum(["number", "text"]),
    })
    .array()
    .optional(),
  resource: z
    .object({
      id: z.string(),
      provider: resourceProvidersSchema,
    })
    .nullable()
    .optional(),
  rawDescription: functionRawDescriptionSchema.array().optional(),
  generatedCode: z.string().nullable().optional(),
  isCodeUpdated: z.boolean().default(false).optional(),
  isLocked: z.boolean().default(false).optional(),
});

export const functionPrimitiveSchema = primitiveBaseSchema.extend({
  type: z.literal("function"),
  metadata: functionPrimitiveMetadataSchema,
});

export const routePrimitiveMetadataSchema = z.object({
  method: z.enum(["get", "post", "patch", "delete"]),
  path: z.string(),
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
    .array()
    .optional(),
});

export const routePrimitiveSchema = primitiveBaseSchema.extend({
  type: z.literal("route"),
  metadata: routePrimitiveMetadataSchema,
});

export const workflowPrimitiveMetadataSchema = z.object({
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
    .array()
    .optional(),
});

export const workflowPrimitiveSchema = primitiveBaseSchema.extend({
  type: z.literal("workflow"),
  metadata: workflowPrimitiveMetadataSchema,
});

export const responsePrimitiveMetadataSchema = z.object({
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
    .array()
    .optional(),
});

export const responsePrimitiveSchema = primitiveBaseSchema.extend({
  type: z.literal("response"),
  metadata: responsePrimitiveMetadataSchema,
});

export const iteratorPrimitiveMetadataSchema = z.object({});

export const iteratorPrimitiveSchema = primitiveBaseSchema.extend({
  type: z.literal("iterator"),
  metadata: iteratorPrimitiveMetadataSchema,
});

export const conditionalBranchPrimitiveMetadataSchema = z.object({});

export const conditionalBranchPrimitiveSchema = primitiveBaseSchema.extend({
  type: z.literal("conditional-branch"),
  metadata: conditionalBranchPrimitiveMetadataSchema,
});

export const primitiveTypesSchema = z.enum([
  "route",
  "workflow",
  "function",
  "conditional-branch",
  "iterator",
  "response",
]);

export const primitiveSchema = z.discriminatedUnion("type", [
  functionPrimitiveSchema,
  routePrimitiveSchema,
  workflowPrimitiveSchema,
  responsePrimitiveSchema,
  iteratorPrimitiveSchema,
  conditionalBranchPrimitiveSchema,
]);

export const primitiveMetadataSchema = z.union([
  functionPrimitiveMetadataSchema,
  routePrimitiveMetadataSchema,
  workflowPrimitiveMetadataSchema,
  responsePrimitiveMetadataSchema,
  iteratorPrimitiveMetadataSchema,
  conditionalBranchPrimitiveMetadataSchema,
]);

export const insertPrimitiveBaseSchema = z.object({
  name: z
    .string()
    .min(1, {
      message: "Name is required.",
    })
    .transform((name) => name.replace(/\s+/g, " ").trim()),
  description: z.string().trim().optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
  metadata: primitiveMetadataSchema,
  flowId: z.string().min(1, {
    message: "Flow is required.",
  }),
});

export const insertBuildingPrimitiveSchema = insertPrimitiveBaseSchema.extend({
  isBuilding: z.literal(true),
  type: z.enum(["function", "iterator", "conditional-branch", "response"]),
});

export const insertFlowPrimitiveSchema = insertPrimitiveBaseSchema.extend({
  isBuilding: z.literal(false),
  type: z.enum(["route", "workflow"]),
});

export const insertPrimitiveSchema = z.discriminatedUnion("isBuilding", [
  insertBuildingPrimitiveSchema,
  insertFlowPrimitiveSchema,
]);

export const updatePrimitiveBaseSchema = z.object({
  name: z
    .string()
    .min(1, {
      message: "Name is required.",
    })
    .transform((name) => name.replace(/\s+/g, " ").trim())
    .optional(),
  description: z.string().trim().optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
});

export const updateFunctionMetadataSchema = z.object({
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
      provider: resourceProvidersSchema,
    })
    .nullable()
    .optional(),
  rawDescription: functionRawDescriptionSchema.array().optional(),
  generatedCode: z.string().nullable().optional(),
  isCodeUpdated: z.boolean().optional(),
  isLocked: z.boolean().default(false).optional(),
});

export const updateFunctionSchema = updatePrimitiveBaseSchema.extend({
  type: z.literal("function"),
  metadata: updateFunctionMetadataSchema.optional(),
});

export const updateRouteMetadataSchema = z.object({
  method: z.enum(["get", "post", "patch", "delete"]).optional(),
  path: z.string().optional(),
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

export const updateRouteSchema = updatePrimitiveBaseSchema.extend({
  type: z.literal("route"),
  metadata: updateRouteMetadataSchema.optional(),
});

export const updateWorkflowMetadataSchema = z.object({
  triggerType: z.enum(["webhook", "schedule"]).optional(),
});

export const updateWorkflowSchema = updatePrimitiveBaseSchema.extend({
  type: z.literal("workflow"),
  metadata: updateWorkflowMetadataSchema.optional(),
});

export const updateConditionalBranchMetadataSchema = z.object({});

export const updateConditionalBranchSchema = updatePrimitiveBaseSchema.extend({
  type: z.literal("conditional-branch"),
  metadata: updateConditionalBranchMetadataSchema.optional(),
});

export const updateIteratorMetadataSchema = z.object({});

export const updateIteratorSchema = updatePrimitiveBaseSchema.extend({
  type: z.literal("iterator"),
  metadata: updateIteratorMetadataSchema.optional(),
});

export const updateResponseMetadataSchema = z.object({});

export const updateResponseSchema = updatePrimitiveBaseSchema.extend({
  type: z.literal("response"),
  metadata: updateResponseMetadataSchema.optional(),
});

export const updatePrimitiveSchema = z.object({
  where: z.object({
    id: z.string(),
  }),
  payload: z.discriminatedUnion("type", [
    updateFunctionSchema,
    updateRouteSchema,
    updateWorkflowSchema,
    updateConditionalBranchSchema,
    updateIteratorSchema,
    updateResponseSchema,
  ]),
});
