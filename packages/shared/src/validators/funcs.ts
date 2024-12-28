import { z } from "zod";
import { databaseTableSchema } from "../integrations/postgres/validators";
import { jsonSchema, npmDependencySchema, rawContentSchema } from "./common";
import { conversationSchema } from "./conversations";
import { funcDependencySchema } from "./func-dependencies";
import { funcInternalGraphConnectionSchema } from "./func-internal-graph";
import { testRunSchema } from "./test-runs";

export const funcResourceSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    name: z.string(),
    type: z.literal("postgres"),
    tables: databaseTableSchema.array(),
  }),
]);

export const funcSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  positionX: z.number().default(0),
  positionY: z.number().default(0),
  inputSchema: jsonSchema.optional(),
  outputSchema: jsonSchema.optional(),
  testInput: z.unknown().optional(),
  rawDescription: rawContentSchema.optional(),
  behavior: rawContentSchema.optional(),
  errors: z.string().optional(),
  docs: z.string().optional(),
  code: z.string().optional(),
  resources: funcResourceSchema.array().optional().nullable(),
  npmDependencies: npmDependencySchema.array().optional().nullable(),
  userId: z.string().nullable(),
  conversationId: z.string().nullable(),
  canRun: z.boolean().optional(),
  projectId: z.string(),
  conversation: conversationSchema,
  testRuns: testRunSchema.array(),
  funcDependencies: funcDependencySchema.array(),
  internalConnections: funcInternalGraphConnectionSchema.array(),
});

export const insertFuncSchema = z.object({
  id: z.string().cuid2(),
  positionX: z.number(),
  positionY: z.number(),
  projectId: z.string().cuid2(),
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
      .optional(),
    positionX: z.number().optional(),
    positionY: z.number().optional(),
    testInput: z.unknown().optional(),
    inputSchema: jsonSchema.optional(),
    outputSchema: jsonSchema.optional(),
    rawDescription: rawContentSchema.optional(),
    behavior: rawContentSchema.optional(),
    errors: z.string().optional(),
    docs: z.string().optional(),
    code: z.string().optional(),
    resources: funcResourceSchema.array().optional().nullable(),
    npmDependencies: npmDependencySchema.array().optional().nullable(),
  }),
});
