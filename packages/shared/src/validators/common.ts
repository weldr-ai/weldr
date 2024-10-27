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

const rawDescriptionBaseReferenceSchema = z.object({
  type: z.literal("reference"),
  name: z.string().describe("The name of the reference"),
});

const rawDescriptionInputReferenceSchema =
  rawDescriptionBaseReferenceSchema.extend({
    referenceType: z.literal("input"),
    dataType: dataTypeSchema.describe("The data type of the reference"),
    source: z.string().describe("The name of the source for this input"),
  });

const rawDescriptionDatabaseReferenceSchema =
  rawDescriptionBaseReferenceSchema.extend({
    referenceType: z.literal("database"),
    id: z.string().describe("The ID of the reference"),
  });

const rawDescriptionDatabaseTableReferenceSchema =
  rawDescriptionBaseReferenceSchema.extend({
    referenceType: z.literal("database-table"),
    database: z.object({
      id: z.string().describe("The ID of the source database"),
      name: z.string().describe("The name of the source database"),
    }),
    columns: z
      .object({
        name: z.string().describe("The name of the column"),
        dataType: z.string().describe("The data type of the column"),
      })
      .array()
      .describe("The columns of the table"),
  });

const rawDescriptionDatabaseColumnReferenceSchema =
  rawDescriptionBaseReferenceSchema.extend({
    referenceType: z.literal("database-column"),
    dataType: dataTypeSchema.describe("The data type of the column"),
    database: z.object({
      id: z.string().describe("The ID of the source database"),
      name: z.string().describe("The name of the source database"),
    }),
    table: z.string().describe("The name of the source table"),
  });

const rawDescriptionTextSchema = z.object({
  type: z.literal("text"),
  value: z.string().describe("The value of the text"),
});

export const rawDescriptionReferenceSchema = z.discriminatedUnion(
  "referenceType",
  [
    rawDescriptionInputReferenceSchema.describe(
      "The input reference part of a message or description. Must be used when mentioning an input reference in a message or description.",
    ),
    rawDescriptionDatabaseReferenceSchema.describe(
      "The database reference part of a message or description. Must be used when mentioning a database reference in a message or description.",
    ),
    rawDescriptionDatabaseTableReferenceSchema.describe(
      "The database-table reference part of a message or description. Must be used when mentioning a database-table reference in a message or description.",
    ),
    rawDescriptionDatabaseColumnReferenceSchema.describe(
      "The database-column reference part of a message or description. Must be used when mentioning a database-column reference in a message or description.",
    ),
  ],
);

export const rawDescriptionSchema = z
  .union([
    rawDescriptionTextSchema.describe(
      "The text part of a message or description. Must be used when mentioning a text in a message or description.",
    ),
    rawDescriptionReferenceSchema.describe(
      "The reference part of a message or description. Must be used when mentioning a reference in a message or description.",
    ),
  ])
  .describe(
    "The content of a message or description as a list of text and reference parts",
  );

export const functionRequirementsMessageSchema = z.object({
  message: z.discriminatedUnion("type", [
    z
      .object({
        type: z.literal("message"),
        content: rawDescriptionSchema.array(),
      })
      .describe("The message of the function requirements gathering"),
    z
      .object({
        type: z.literal("end"),
        content: z.object({
          inputs: z
            .string()
            .describe(
              "The JSON schema for the inputs of the function. The names of the properties must be in camelCase.",
            ),
          outputs: z
            .string()
            .describe(
              "The JSON schema for the outputs of the function. The names of the properties must be in camelCase.",
            ),
          description: rawDescriptionSchema.array().describe(
            `The description of the function. Must consist of text and reference parts. The reference parts must be used when mentioning a reference in the description.
              # Guidelines:
                - Must use the \`reference\` type for input references, database references, database-column references, and database-table references.
                - Must use the \`text\` type for any text in the description that is not a reference.`,
          ),
          resources: z
            .string()
            .array()
            .describe("The list of IDs of resources used in the function."),
          logicalSteps: z
            .string()
            .describe("The logical steps of the function"),
          edgeCases: z.string().describe("The edge cases of the function"),
          errorHandling: z
            .string()
            .describe(
              "The error handling of the function. Assume that inputs are always valid.",
            ),
          dependencies: z
            .string()
            .array()
            .optional()
            .describe(
              `The npm dependencies of the function.
              # Guidelines:
                - Don't worry about specifying dependencies for the database provider.
                - Don't worry about the version of the packages.
                - Must be a valid npm package name.
                - Include @types packages if they are needed.
                - Don't use suspicious packages.
                - Don't use packages that are not necessary for the function to work.
                - Don't use packages that are not maintained anymore.
                - Don't use packages that have been deprecated recently.
                - Don't use packages with known security vulnerabilities.
                - Don't use packages that are only used for development or testing.
                - Don't use packages that are not popular.
                - Don't use packages that are not well-documented.
                - Don't use packages that are not maintained by a reputable organization.`,
            ),
        }),
      })
      .describe("The last message of the function requirements gathering"),
  ]),
});

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
