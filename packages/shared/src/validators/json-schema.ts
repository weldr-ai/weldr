import type { JSONSchema7 } from "json-schema";
import { z } from "zod";

// JSON Schema Data Types
export const dataTypeSchema = z
  .enum(["string", "number", "integer", "boolean", "object", "array", "null"])
  .describe("The data type of a JSON Schema value");

// JSON Schema Object
export const jsonSchema: z.ZodType<JSONSchema7> = z
  .lazy(() =>
    z.object({
      // Basic schema properties
      type: dataTypeSchema
        .optional()
        .describe("The type of value this schema validates"),
      title: z
        .string()
        .optional()
        .describe("A human-readable title for the schema"),
      description: z
        .string()
        .optional()
        .describe("A detailed explanation of what this schema validates"),

      // For objects
      required: z
        .array(z.string())
        .optional()
        .describe("List of property names that must be present"),
      properties: z
        .record(jsonSchema)
        .optional()
        .describe("Schema definitions for each property of an object"),
      additionalProperties: z
        .union([z.boolean(), jsonSchema])
        .optional()
        .describe(
          "Whether additional properties are allowed, or a schema they must match",
        ),

      // For arrays
      items: z
        .union([jsonSchema, z.array(jsonSchema)])
        .optional()
        .describe(
          "Schema that array items must match, or list of schemas for tuple validation",
        ),
      minItems: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Minimum number of items required in array"),
      maxItems: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Maximum number of items allowed in array"),
      uniqueItems: z
        .boolean()
        .optional()
        .describe("Whether array items must be unique"),

      // String validations
      minLength: z
        .number()
        .int()
        .nonnegative()
        .optional()
        .describe("Minimum length of string"),
      maxLength: z
        .number()
        .int()
        .nonnegative()
        .optional()
        .describe("Maximum length of string"),
      pattern: z
        .string()
        .optional()
        .describe("Regular expression pattern string must match"),
      format: z
        .string()
        .optional()
        .describe(
          "Predefined format the string must conform to (e.g. email, date-time)",
        ),

      // Number validations
      minimum: z.number().optional().describe("Minimum value (inclusive)"),
      maximum: z.number().optional().describe("Maximum value (inclusive)"),
      exclusiveMinimum: z
        .number()
        .optional()
        .describe("Minimum value (exclusive)"),
      exclusiveMaximum: z
        .number()
        .optional()
        .describe("Maximum value (exclusive)"),
      multipleOf: z
        .number()
        .positive()
        .optional()
        .describe("Number must be a multiple of this value"),

      // Combiners
      oneOf: z
        .array(jsonSchema)
        .optional()
        .describe("Value must match exactly one of these schemas"),
      anyOf: z
        .array(jsonSchema)
        .optional()
        .describe("Value must match at least one of these schemas"),
      allOf: z
        .array(jsonSchema)
        .optional()
        .describe("Value must match all of these schemas"),
      not: jsonSchema.optional().describe("Value must not match this schema"),

      // Conditionals
      if: jsonSchema.optional().describe("Schema to conditionally evaluate"),
      // biome-ignore lint/suspicious/noThenProperty: Required for JSON Schema conditional
      then: jsonSchema
        .optional()
        .describe("Schema to use if 'if' schema matches"),
      else: jsonSchema
        .optional()
        .describe("Schema to use if 'if' schema does not match"),

      // Enum
      enum: z
        .array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
        .optional()
        .describe("List of allowed values"),
      const: z
        .union([z.string(), z.number(), z.boolean(), z.null()])
        .optional()
        .describe("Constant value that this schema validates"),

      // Schema metadata
      $id: z.string().optional().describe("Unique identifier for this schema"),
      $schema: z.string().optional().describe("JSON Schema version identifier"),
      $ref: z
        .string()
        .optional()
        .describe("Reference to another schema definition"),
      $comment: z
        .string()
        .optional()
        .describe("Internal comment for schema maintainers"),
      $defs: z
        .record(jsonSchema)
        .optional()
        .describe("Container for schema definitions that can be referenced"),
      definitions: z
        .record(jsonSchema)
        .optional()
        .describe("Legacy container for schema definitions (prefer $defs)"),

      // Content
      contentMediaType: z
        .string()
        .optional()
        .describe("MIME type of the string content"),
      contentEncoding: z
        .string()
        .optional()
        .describe("Encoding used for the string content"),

      // Additional metadata
      readOnly: z
        .boolean()
        .optional()
        .describe("Whether the value should be treated as read-only"),
      writeOnly: z
        .boolean()
        .optional()
        .describe("Whether the value should be treated as write-only"),
      examples: z
        .array(z.any())
        .optional()
        .describe("Sample values that validate against this schema"),
      default: z
        .any()
        .optional()
        .describe("Default value to use if none is provided"),
    }),
  )
  .describe("A JSON Schema definition");
