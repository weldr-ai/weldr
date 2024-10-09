import { z } from "zod";
import type { JsonSchema } from "../types";

export const varTypeSchema = z.enum([
  "string",
  "number",
  "integer",
  "boolean",
  "array",
  "object",
  "null",
]);

export const baseJsonSchema = z.object({
  type: varTypeSchema,
  description: z.string().optional(),
  required: z.string().array().optional(),
  enum: z.any().array().optional(),
});

export const jsonSchema: z.ZodType<JsonSchema> = baseJsonSchema.and(
  z.object({
    type: varTypeSchema,
    properties: z.record(z.lazy(() => jsonSchema)).optional(),
    items: z.lazy(() => jsonSchema).optional(),
  }),
);

export const inputSchema = jsonSchema;
export const outputSchema = jsonSchema;

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

export const conversationMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  rawContent: rawDescriptionSchema.array().optional().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  conversationId: z.string(),
});

export const conversationSchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  messages: conversationMessageSchema.array(),
});
