import { z } from "zod";
import { databaseTableSchema } from "../integrations/postgres";
import {
  inputSchema,
  outputSchema,
  rawContentSchema,
  utilityFunctionReferenceSchema,
} from "./common";
import { conversationSchema } from "./conversations";

export const testRunSchema = z.object({
  id: z.string(),
  input: z.any(),
  output: z.any(),
  status: z.enum(["success", "error"]),
  createdAt: z.date(),
  primitiveId: z.string(),
});

export const primitiveTypesSchema = z.enum(["function", "stop"]);

export const primitiveBaseSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().nullable(),
  positionX: z.number(),
  positionY: z.number(),
  flowId: z.string(),
  conversationId: z.string(),
});

export const functionResourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  metadata: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("database"),
      tables: databaseTableSchema.array(),
    }),
  ]),
  utilities: utilityFunctionReferenceSchema.omit({ docs: true }).array(),
});

export const functionPrimitiveMetadataSchema = z.object({
  inputSchema: inputSchema.optional(),
  outputSchema: outputSchema.optional(),
  testInput: z.unknown().optional(),
  description: z.string().optional(),
  rawDescription: rawContentSchema.optional(),
  code: z.string().optional(),
  logicalSteps: rawContentSchema.optional(),
  edgeCases: z.string().optional(),
  errorHandling: z.string().optional(),
  resources: functionResourceSchema.array().optional(),
  dependencies: z
    .array(z.object({ name: z.string(), version: z.string().optional() }))
    .optional(),
});

export const primitiveMetadataSchema = z.union([
  functionPrimitiveMetadataSchema,
  z.null(),
]);

export const functionPrimitiveSchema = primitiveBaseSchema.extend({
  type: z.literal("function"),
  conversation: conversationSchema.optional(),
  testRuns: testRunSchema.array().optional(),
  metadata: functionPrimitiveMetadataSchema.nullable().optional(),
});

export const stopPrimitiveSchema = primitiveBaseSchema.extend({
  type: z.literal("stop"),
  metadata: z.null().optional(),
});

export const primitiveSchema = z.discriminatedUnion("type", [
  functionPrimitiveSchema,
  stopPrimitiveSchema,
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
    .min(1, {
      message: "Name is required.",
    })
    .regex(/^\S*$/, {
      message: "Cannot contain spaces.",
    })
    .transform((name) => name.trim())
    .nullable()
    .optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
});

export const updateFunctionSchema = updatePrimitiveBaseSchema.extend({
  type: z.literal("function"),
  metadata: functionPrimitiveMetadataSchema.nullable().optional(),
});

export const updateStopSchema = updatePrimitiveBaseSchema.extend({
  type: z.literal("stop"),
  metadata: z.null().optional(),
});

export const updatePrimitiveSchema = z.object({
  where: z.object({
    id: z.string(),
  }),
  payload: z.discriminatedUnion("type", [
    updateFunctionSchema,
    updateStopSchema,
  ]),
});
