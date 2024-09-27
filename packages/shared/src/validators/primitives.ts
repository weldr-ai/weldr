import { z } from "zod";
import type { JsonSchema } from "../types";
import { resourceProvidersSchema } from "./resources";

export const varTypeSchema = z.enum([
  "string",
  "number",
  "integer",
  "boolean",
  "array",
  "object",
  "null",
]);

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
    dataType: varTypeSchema.optional(),
  }),
]);

export const chatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  message: z.string(),
  rawMessage: rawDescriptionSchema.array().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  primitiveId: z.string(),
});

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
  chatMessages: chatMessageSchema.array().optional(),
});

export const baseJsonSchema = z.object({
  type: varTypeSchema,
  description: z.string().optional(),
  required: z.string().array().optional(),
  enum: z.any().array().optional(),
});

export const jsonSchema: z.ZodType<JsonSchema> = baseJsonSchema.and(
  z.object({
    type: z.literal("object"),
    properties: z.record(z.lazy(() => jsonSchema)).optional(),
    items: z.lazy(() => jsonSchema).optional(),
  }),
);

export const inputSchema = jsonSchema.and(
  z.object({
    testValue: z
      .union([
        z.string(),
        z.number(),
        z.boolean(),
        z.array(z.any()),
        z.record(z.any()),
        z.null(),
      ])
      .optional(),
  }),
);

export const outputSchema = jsonSchema.and(
  z.object({
    id: z.string(),
  }),
);

const baseMetadataSchema = z.object({
  inputSchema: inputSchema.optional(),
  outputSchema: outputSchema.optional(),
  generatedCode: z.string().nullable().optional(),
  isCodeUpdated: z.boolean().default(false).optional(),
  isLocked: z.boolean().default(false).optional(),
  resources: z
    .object({
      id: z.string(),
      name: z.string(),
      provider: resourceProvidersSchema,
    })
    .array()
    .optional(),
});

export const functionPrimitiveMetadataSchema = baseMetadataSchema.extend({
  rawDescription: rawDescriptionSchema.array().optional(),
  logicalSteps: z.string().optional(),
  edgeCases: z.string().optional(),
  errorHandling: z.string().optional(),
  resources: z
    .object({
      id: z.string(),
      name: z.string(),
      provider: resourceProvidersSchema,
      metadata: z.string(),
    })
    .array()
    .optional(),
});

export const functionPrimitiveSchema = primitiveBaseSchema.extend({
  type: z.literal("function"),
  metadata: functionPrimitiveMetadataSchema,
});

export const routePrimitiveMetadataSchema = z.object({
  method: z.enum(["get", "post", "patch", "delete"]),
  path: z.string(),
  inputSchema: inputSchema.optional(),
  validationSchema: z.string().optional(),
});

export const routePrimitiveSchema = primitiveBaseSchema.extend({
  type: z.literal("route"),
  metadata: routePrimitiveMetadataSchema,
});

export const workflowPrimitiveMetadataSchema = z.object({
  triggerType: z.enum(["webhook", "schedule"]),
  inputSchema: inputSchema.optional(),
  validationSchema: z.string().optional(),
});

export const workflowPrimitiveSchema = primitiveBaseSchema.extend({
  type: z.literal("workflow"),
  metadata: workflowPrimitiveMetadataSchema,
});

export const responsePrimitiveMetadataSchema = baseMetadataSchema.extend({
  rawDescription: rawDescriptionSchema.array().optional(),
});

export const responsePrimitiveSchema = primitiveBaseSchema.extend({
  type: z.literal("response"),
  metadata: responsePrimitiveMetadataSchema,
});

export const iteratorPrimitiveMetadataSchema = baseMetadataSchema.extend({
  iteratorType: z.enum(["for-each", "map", "reduce"]).optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  rawDescription: rawDescriptionSchema.array().optional(),
});

export const iteratorPrimitiveSchema = primitiveBaseSchema.extend({
  type: z.literal("iterator"),
  metadata: iteratorPrimitiveMetadataSchema,
});

export const matcherPrimitiveMetadataSchema = baseMetadataSchema.extend({
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
  type: z.enum(["function", "iterator", "matcher", "response"]),
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
  parentId: z.string().nullable().optional(),
  description: z.string().trim().optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
});

export const updateFunctionMetadataSchema = functionPrimitiveMetadataSchema;

export const updateFunctionSchema = updatePrimitiveBaseSchema.extend({
  type: z.literal("function"),
  metadata: updateFunctionMetadataSchema.optional(),
});

export const updateRouteMetadataSchema = baseMetadataSchema.extend({
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
  inputSchema: inputSchema.optional(),
  validationSchema: z.string().optional(),
});

export const updateRouteSchema = updatePrimitiveBaseSchema.extend({
  type: z.literal("route"),
  metadata: updateRouteMetadataSchema.optional(),
});

export const updateWorkflowMetadataSchema = baseMetadataSchema.extend({
  triggerType: z.enum(["webhook", "schedule"]).optional(),
});

export const updateWorkflowSchema = updatePrimitiveBaseSchema.extend({
  type: z.literal("workflow"),
  metadata: updateWorkflowMetadataSchema.optional(),
});

export const updateMatcherSchema = updatePrimitiveBaseSchema.extend({
  type: z.literal("matcher"),
  metadata: matcherPrimitiveMetadataSchema.optional(),
});

export const updateIteratorSchema = updatePrimitiveBaseSchema.extend({
  type: z.literal("iterator"),
  metadata: iteratorPrimitiveMetadataSchema.optional(),
});

export const updateResponseMetadataSchema =
  responsePrimitiveMetadataSchema.extend({
    rawDescription: rawDescriptionSchema.array().optional(),
  });

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
    updateMatcherSchema,
    updateIteratorSchema,
    updateResponseSchema,
  ]),
});
