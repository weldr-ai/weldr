import { z } from "zod";
import { resourceProvidersSchema } from "./resources";

export const primitiveBaseSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  description: z.string().nullable(),
  parentId: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
  positionX: z.number(),
  positionY: z.number(),
  flowId: z.string(),
});

export const rawDescriptionSchema = z.discriminatedUnion("type", [
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
  rawDescription: rawDescriptionSchema.array().optional(),
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
  rawDescription: rawDescriptionSchema.array().optional(),
});

export const responsePrimitiveSchema = primitiveBaseSchema.extend({
  type: z.literal("response"),
  metadata: responsePrimitiveMetadataSchema,
});

export const iteratorPrimitiveMetadataSchema = z.object({
  iteratorType: z.enum(["for-each", "map", "reduce"]),
});

export const iteratorPrimitiveSchema = primitiveBaseSchema.extend({
  type: z.literal("iterator"),
  metadata: iteratorPrimitiveMetadataSchema,
});

export const matcherPrimitiveMetadataSchema = z.object({
  conditions: z
    .object({
      id: z.string(),
      description: z.string().nullable(),
      rawDescription: rawDescriptionSchema.array().optional(),
    })
    .array(),
});

export const matcherPrimitiveSchema = primitiveBaseSchema.extend({
  type: z.literal("matcher"),
  metadata: matcherPrimitiveMetadataSchema,
});

export const iteratorInputPrimitiveSchema = primitiveBaseSchema.extend({
  type: z.literal("iterator-input"),
});

export const iteratorOutputPrimitiveSchema = primitiveBaseSchema.extend({
  type: z.literal("iterator-output"),
});

export const primitiveTypesSchema = z.enum([
  "route",
  "workflow",
  "function",
  "matcher",
  "iterator",
  "response",
]);

export const primitiveSchema = z.discriminatedUnion("type", [
  routePrimitiveSchema,
  workflowPrimitiveSchema,
  functionPrimitiveSchema,
  responsePrimitiveSchema,
  iteratorPrimitiveSchema,
  matcherPrimitiveSchema,
]);

export const primitiveMetadataSchema = z.union([
  routePrimitiveMetadataSchema,
  workflowPrimitiveMetadataSchema,
  functionPrimitiveMetadataSchema,
  responsePrimitiveMetadataSchema,
  iteratorPrimitiveMetadataSchema,
  matcherPrimitiveMetadataSchema,
]);

export const insertPrimitiveSchema = z.object({
  id: z.string(),
  type: z.enum([
    "function",
    "iterator",
    "matcher",
    "response",
    "iterator-input",
    "iterator-output",
  ]),
  description: z.string().trim().optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
  metadata: primitiveMetadataSchema,
  parentId: z.string().optional(),
  flowId: z.string().min(1, {
    message: "Flow is required.",
  }),
});

export const updatePrimitiveBaseSchema = z.object({
  name: z
    .string()
    .regex(/^[a-z0-9_]+$/, {
      message:
        "Name must only contain lowercase letters, numbers, and underscores",
    })
    .regex(/^[a-z0-9].*[a-z0-9]$/, {
      message: "Name must not start or end with an underscore",
    })
    .regex(/^(?!.*__).*$/, {
      message: "Name must not contain consecutive underscores",
    })
    .transform((name) => name.replace(/\s+/g, "_").toLowerCase().trim())
    .optional(),
  parentId: z.string().optional(),
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
  rawDescription: rawDescriptionSchema.array().optional(),
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
  path: z
    .string()
    .regex(/^\/[a-z-]+(\/[a-z-]+)*$/, {
      message:
        "Must start with '/' and contain only lowercase letters and hyphens.",
    })
    .transform((path) => {
      if (path.startsWith("/")) return path.trim();
      return `/${path.trim()}`;
    })
    .optional(),
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

export const updateMatcherMetadataSchema = z.object({
  conditions: z
    .object({
      description: z.string().trim().nullable(),
      rawDescription: rawDescriptionSchema.array().optional(),
    })
    .array()
    .optional(),
});

export const updateMatcherSchema = updatePrimitiveBaseSchema.extend({
  type: z.literal("matcher"),
  metadata: updateMatcherMetadataSchema.optional(),
});

export const updateIteratorSchema = updatePrimitiveBaseSchema.extend({
  type: z.literal("iterator"),
  metadata: z
    .object({
      iteratorType: z.enum(["for-each", "map", "reduce"]),
    })
    .optional(),
});

export const updateResponseMetadataSchema = z.object({
  rawDescription: rawDescriptionSchema.array().optional(),
});

export const updateResponseSchema = updatePrimitiveBaseSchema.extend({
  type: z.literal("response"),
  metadata: updateResponseMetadataSchema.optional(),
});

export const updatePrimitiveSchema = z.object({
  where: z.object({
    id: z.string(),
    flowId: z.string(),
  }),
  payload: z.discriminatedUnion("type", [
    updateFunctionSchema,
    updateRouteSchema,
    updateWorkflowSchema,
    updateMatcherSchema,
    updateIteratorSchema,
    updateResponseSchema,
  ]),
});
