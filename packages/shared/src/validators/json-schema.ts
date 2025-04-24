import { z } from "zod";

// JSON Schema Data Types
export const dataTypeSchema = z
  .union([
    z.string().describe("TypeScript type literal"),
    z.enum([
      "string",
      "number",
      "integer",
      "boolean",
      "object",
      "array",
      "null",
    ]),
    z.array(
      z.enum([
        "string",
        "number",
        "integer",
        "boolean",
        "object",
        "array",
        "null",
      ]),
    ),
  ])
  .describe("The data type of a JSON Schema value");

// Basic value types that can be used in enum and const
export const basicValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

// Schema for simple validations (no nested schemas)
export const simpleValidationSchema = z.object({
  // Basic schema properties
  type: dataTypeSchema.nullable().optional(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),

  // String validations
  minLength: z.number().int().nonnegative().nullable().optional(),
  maxLength: z.number().int().nonnegative().nullable().optional(),
  pattern: z.string().nullable().optional(),
  format: z.string().nullable().optional(),

  // Number validations
  minimum: z.number().nullable().optional(),
  maximum: z.number().nullable().optional(),
  exclusiveMinimum: z.number().nullable().optional(),
  exclusiveMaximum: z.number().nullable().optional(),
  multipleOf: z.number().positive().nullable().optional(),

  // Enum and const
  enum: z.array(basicValueSchema).nullable().optional(),
  const: basicValueSchema.nullable().optional(),

  // Schema metadata
  $id: z.string().nullable().optional(),
  $schema: z.string().nullable().optional(),
  $ref: z.string().nullable().optional(),
  $comment: z.string().nullable().optional(),

  // Content
  contentMediaType: z.string().nullable().optional(),
  contentEncoding: z.string().nullable().optional(),

  // Additional metadata
  readOnly: z.boolean().nullable().optional(),
  writeOnly: z.boolean().nullable().optional(),
  examples: z.array(z.any()).nullable().optional(),
  default: z.any().nullable().optional(),
});

// Final JSON Schema without recursion
export const jsonSchema = simpleValidationSchema.extend({
  // For objects
  required: z.array(z.string()).nullable().optional(),
  properties: z.record(z.any()).nullable().optional(),
  additionalProperties: z.union([z.boolean(), z.any()]).nullable().optional(),

  // For arrays
  items: z
    .union([z.any(), z.array(z.any())])
    .nullable()
    .optional(),
  minItems: z.number().int().positive().nullable().optional(),
  maxItems: z.number().int().positive().nullable().optional(),
  uniqueItems: z.boolean().nullable().optional(),

  // Combiners
  oneOf: z.array(z.any()).nullable().optional(),
  anyOf: z.array(z.any()).nullable().optional(),
  allOf: z.array(z.any()).nullable().optional(),
  not: z.any().nullable().optional(),

  // Conditionals
  if: z.any().nullable().optional(),
  // biome-ignore lint/suspicious/noThenProperty: Required for JSON Schema conditional
  then: z.any().nullable().optional(),
  else: z.any().nullable().optional(),

  // Schema definitions
  $defs: z.record(z.any()).nullable().optional(),
  definitions: z.record(z.any()).nullable().optional(),
});
