import { z } from "zod";
import {
  conversationSchema,
  inputSchema,
  outputSchema,
  rawDescriptionSchema,
} from "./common";
import { resourceProvidersSchema } from "./resources";

export const primitiveTypesSchema = z.enum(["function", "response"]);

export const primitiveBaseSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  inputSchema: inputSchema.nullable().optional(),
  outputSchema: outputSchema.nullable().optional(),
  description: z.string().nullable(),
  rawDescription: rawDescriptionSchema.array().nullable().optional(),
  generatedCode: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
  positionX: z.number(),
  positionY: z.number(),
  flowId: z.string(),
  conversation: conversationSchema,
});

export const functionPrimitiveMetadataSchema = z.object({
  logicalSteps: z.string().optional(),
  edgeCases: z.string().optional(),
  errorHandling: z.string().optional(),
  resources: z
    .object({
      id: z.string(),
      provider: resourceProvidersSchema,
    })
    .array()
    .optional(),
  npmDependencies: z.string().array().optional(),
});

export const primitiveMetadataSchema = z.union([
  functionPrimitiveMetadataSchema,
  z.null(),
]);

export const functionPrimitiveSchema = primitiveBaseSchema.extend({
  type: z.literal("function"),
  metadata: functionPrimitiveMetadataSchema.nullable().optional(),
});

export const responsePrimitiveSchema = primitiveBaseSchema.extend({
  type: z.literal("response"),
  metadata: z.null().optional(),
});

export const primitiveSchema = z.discriminatedUnion("type", [
  functionPrimitiveSchema,
  responsePrimitiveSchema,
]);

export const insertPrimitiveSchema = z.object({
  id: z.string(),
  type: primitiveTypesSchema,
  positionX: z.number(),
  positionY: z.number(),
  flowId: z.string(),
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
    .nullable()
    .optional(),
  inputSchema: inputSchema.nullable().optional(),
  outputSchema: outputSchema.nullable().optional(),
  description: z.string().trim().nullable().optional(),
  rawDescription: rawDescriptionSchema.array().nullable().optional(),
  generatedCode: z.string().nullable().optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
});

export const updateFunctionSchema = updatePrimitiveBaseSchema.extend({
  type: z.literal("function"),
  metadata: functionPrimitiveMetadataSchema.nullable().optional(),
});

export const updateResponseSchema = updatePrimitiveBaseSchema.extend({
  type: z.literal("response"),
  metadata: z.null().optional(),
});

export const updatePrimitiveSchema = z.object({
  where: z.object({
    id: z.string(),
  }),
  payload: z.discriminatedUnion("type", [
    updateFunctionSchema,
    updateResponseSchema,
  ]),
});
