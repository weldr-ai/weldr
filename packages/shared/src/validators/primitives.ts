import { z } from "zod";
import { databaseTableSchema } from "../integrations/postgres";
import {
  inputSchema,
  outputSchema,
  packageSchema,
  rawContentSchema,
  utilityFunctionReferenceSchema,
} from "./common";
import { conversationSchema } from "./conversations";

export const testRunSchema = z.object({
  id: z.string(),
  input: z.any(),
  output: z.any(),
  createdAt: z.date(),
  primitiveId: z.string(),
});

export const dependencySchema = z.object({
  id: z.string(),
  targetPrimitiveId: z.string(),
  sourcePrimitiveId: z.string(),
  sourceUtilityId: z.string(),
});

export const primitiveResourceSchema = z.object({
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

export const primitiveSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  positionX: z.number(),
  positionY: z.number(),
  inputSchema: inputSchema.optional(),
  outputSchema: outputSchema.optional(),
  testInput: z.unknown().optional(),
  description: z.string().optional(),
  rawDescription: rawContentSchema.optional(),
  code: z.string().optional(),
  logicalSteps: rawContentSchema.optional(),
  edgeCases: z.string().optional(),
  errorHandling: z.string().optional(),
  resources: primitiveResourceSchema.array().optional(),
  packages: packageSchema.array().optional(),
  userId: z.string().nullable(),
  flowId: z.string(),
  conversationId: z.string(),
  conversation: conversationSchema,
  testRuns: testRunSchema.array(),
});

export const insertPrimitiveSchema = z.object({
  id: z.string(),
  flowId: z.string(),
  positionX: z.number(),
  positionY: z.number(),
});

export const updatePrimitiveSchema = z.object({
  where: z.object({
    id: z.string(),
  }),
  payload: z.object({
    name: z
      .string()
      .min(1, {
        message: "Name is required.",
      })
      .regex(/^[a-z]/, {
        message: "Name must start with a small letter",
      })
      .regex(/^[a-z][a-zA-Z0-9]*$/, {
        message: "Can only contain letters and numbers",
      })
      .nullable()
      .optional(),
    positionX: z.number().optional(),
    positionY: z.number().optional(),
    testInput: z.unknown().optional(),
    inputSchema: inputSchema.optional(),
    outputSchema: outputSchema.optional(),
    description: z.string().optional(),
    rawDescription: rawContentSchema.optional(),
    code: z.string().optional(),
    logicalSteps: rawContentSchema.optional(),
    edgeCases: z.string().optional(),
    errorHandling: z.string().optional(),
    resources: primitiveResourceSchema.array().optional(),
    packages: packageSchema.array().optional(),
  }),
});
