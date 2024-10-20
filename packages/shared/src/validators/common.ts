import { z } from "zod";
import type { JsonSchema } from "../types";

export const dataTypeSchema = z.enum([
  "string",
  "number",
  "integer",
  "boolean",
  "array",
  "object",
  "null",
]);

export const baseJsonSchema = z.object({
  type: dataTypeSchema,
  description: z.string().optional(),
  required: z.string().array().optional(),
  enum: z.any().array().optional(),
});

export const jsonSchema: z.ZodType<JsonSchema> = baseJsonSchema.and(
  z.object({
    type: dataTypeSchema,
    properties: z.record(z.lazy(() => jsonSchema)).optional(),
    items: z.lazy(() => jsonSchema).optional(),
  }),
);

export const inputSchema = jsonSchema;
export const outputSchema = jsonSchema;

export const rawDescriptionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    value: z
      .string()
      .describe(
        "The text part of a message or description. Cannot be used to mention a reference in a message or description.",
      ),
  }),
  z
    .object({
      type: z.literal("reference"),
      id: z
        .string()
        .optional()
        .describe(
          "ID of the reference as stated in the user messages. Only applicable for references of type `database`.",
        ),
      referenceType: z
        .enum(["input", "database", "database-table", "database-column"])
        .describe("Type of the reference"),
      name: z
        .string()
        .describe(
          "Name of the reference. When referencing a database-column the name must following the following naming pattern [TABLE_NAME].[COLUMN_NAME].",
        ),
      dataType: dataTypeSchema
        .optional()
        .describe(
          "Data type of the reference. Only applicable for input and output references.",
        ),
    })
    .describe(
      "The reference part of a message or description. Must be used when mentioning a reference in a message or description.",
    ),
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
