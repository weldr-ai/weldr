import { z } from "zod";
import { databaseTableSchema } from "../integrations/postgres";
import {
  inputSchema,
  npmDependencySchema,
  outputSchema,
  rawContentSchema,
} from "./common";
import { conversationSchema } from "./conversations";
import { funcDependencySchema } from "./func-dependencies";
import { funcInternalGraphConnectionSchema } from "./func-internal-graph";
import { testRunSchema } from "./test-runs";

export const funcResourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  metadata: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("database"),
      tables: databaseTableSchema.array(),
    }),
  ]),
});

export const funcSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  positionX: z.number().default(0),
  positionY: z.number().default(0),
  inputSchema: inputSchema.optional(),
  outputSchema: outputSchema.optional(),
  testInput: z.unknown().optional(),
  description: z.string().optional(),
  rawDescription: rawContentSchema.optional(),
  code: z.string().optional(),
  documentation: z.string().optional(),
  logicalSteps: rawContentSchema.optional(),
  edgeCases: z.string().optional(),
  errorHandling: z.string().optional(),
  resources: funcResourceSchema.array().optional().nullable(),
  npmDependencies: npmDependencySchema.array().optional().nullable(),
  userId: z.string().nullable(),
  conversationId: z.string().nullable(),
  moduleId: z.string(),
  canRun: z.boolean().optional(),
  conversation: conversationSchema,
  testRuns: testRunSchema.array(),
  funcDependencies: funcDependencySchema.array(),
  internalConnections: funcInternalGraphConnectionSchema.array(),
});

export const insertFuncSchema = z.object({
  id: z.string(),
  moduleId: z.string(),
  positionX: z.number(),
  positionY: z.number(),
});

export const updateFuncSchema = z.object({
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
    documentation: z.string().optional(),
    logicalSteps: rawContentSchema.optional(),
    edgeCases: z.string().optional(),
    errorHandling: z.string().optional(),
    resources: funcResourceSchema.array().optional().nullable(),
    npmDependencies: npmDependencySchema.array().optional().nullable(),
  }),
});
