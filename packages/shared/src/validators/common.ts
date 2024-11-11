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

export const jsonSchemaPropertySchema = z.object({
  $id: z.string().optional(),
  $ref: z.string().optional(),
  type: dataTypeSchema,
  title: z.string().optional(),
  description: z.string().optional(),
  required: z.array(z.string()).optional(),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  enum: z.any().array().optional(),
  format: z.string().optional(),
});

export const jsonSchema: z.ZodType<JsonSchema> = jsonSchemaPropertySchema.and(
  z.object({
    properties: z.record(z.lazy(() => jsonSchema)).optional(),
    items: z.lazy(() => jsonSchema).optional(),
  }),
);

export const inputSchema = jsonSchema;
export const outputSchema = jsonSchema;

export const inputReferenceSchema = z.object({
  name: z.string().describe("The name of the input. Must be in camelCase."),
  dataType: dataTypeSchema.describe("The data type of the input"),
  refUri: z.string().describe("The URI of the input reference"),
  required: z.boolean().describe("Whether the input is required"),
});

export const databaseReferenceSchema = z.object({
  id: z.string().describe("The ID of the database"),
  name: z.string().describe("The name of the database"),
  utils: z
    .object({
      id: z.string().describe("The ID of the utility"),
      name: z.string().describe("The name of the utility"),
      description: z.string().describe("The description of the utility"),
    })
    .array()
    .describe("The utilities of the database"),
});

export const databaseTableReferenceSchema = z.object({
  name: z.string().describe("The name of the table"),
  database: databaseReferenceSchema.describe("The database of the table"),
  columns: z
    .object({
      name: z.string().describe("The name of the column"),
      dataType: z.string().describe("The SQL data type of the column"),
    })
    .array()
    .describe("The columns of the table"),
  relationships: z
    .object({
      columnName: z.string().describe("The name of the column"),
      referencedTable: z.string().describe("The name of the referenced table"),
      referencedColumn: z
        .string()
        .describe("The name of the referenced column"),
    })
    .array(),
});

export const databaseColumnReferenceSchema = z.object({
  name: z
    .string()
    .describe(
      "When referencing a database column, the name must follow the pattern '[TABLE_NAME].[COLUMN_NAME]' (e.g. 'users.email', 'orders.status').",
    ),
  dataType: z.string().describe("The SQL data type of the column"),
  database: databaseReferenceSchema.describe("The database of the column"),
  table: databaseTableReferenceSchema
    .omit({ database: true, columns: true, relationships: true })
    .describe("The table of the column"),
});

export const utilityFunctionReferenceSchema = z.object({
  id: z.string().describe("The ID of the utility function"),
  name: z.string().describe("The name of the utility function"),
  description: z.string().describe("The description of the utility function"),
  docs: z.string().describe("The documentation of the utility function"),
});

export const rawContentTextElementSchema = z.object({
  type: z.literal("text"),
  value: z.string().describe("The value of the text"),
});

export const rawContentInputReferenceSchema = z.object({
  type: z.literal("reference"),
  referenceType: z.literal("input"),
  ...inputReferenceSchema.omit({ refUri: true }).shape,
});

export const rawContentDatabaseReferenceSchema = z.object({
  type: z.literal("reference"),
  referenceType: z.literal("database"),
  ...databaseReferenceSchema.omit({ utils: true }).shape,
});

export const rawContentDatabaseTableReferenceSchema = z.object({
  type: z.literal("reference"),
  referenceType: z.literal("database-table"),
  ...databaseTableReferenceSchema.omit({
    database: true,
    columns: true,
    relationships: true,
  }).shape,
});

export const rawContentDatabaseColumnReferenceSchema = z.object({
  type: z.literal("reference"),
  referenceType: z.literal("database-column"),
  ...databaseColumnReferenceSchema.omit({ database: true, table: true }).shape,
});

export const rawContentUtilityFunctionReferenceSchema = z.object({
  type: z.literal("reference"),
  referenceType: z.literal("utility-function"),
  ...utilityFunctionReferenceSchema.omit({
    description: true,
    id: true,
    docs: true,
  }).shape,
});

export const rawContentReferenceElementSchema = z.discriminatedUnion(
  "referenceType",
  [
    rawContentInputReferenceSchema.describe(
      "The input reference part of a message or description. Must be used when mentioning an input in a message or description.",
    ),
    rawContentDatabaseReferenceSchema.describe(
      "The database reference part of a message or description. Must be used when mentioning a database in a message or description.",
    ),
    rawContentDatabaseTableReferenceSchema.describe(
      "The database-table reference part of a message or description. Must be used when mentioning a database table in a message or description.",
    ),
    rawContentDatabaseColumnReferenceSchema.describe(
      "The database-column reference part of a message or description. Must be used when mentioning a database column in a message or description.",
    ),
    rawContentUtilityFunctionReferenceSchema.describe(
      "The utility function reference part of a message or description. Must be used when mentioning a utility function in a message or description.",
    ),
  ],
);

export const rawContentSchema = z
  .union([rawContentTextElementSchema, rawContentReferenceElementSchema])
  .array();

const inputRawContentSchema = z
  .union([
    rawContentTextElementSchema,
    rawContentInputReferenceSchema,
    rawContentDatabaseReferenceSchema,
    rawContentDatabaseTableReferenceSchema,
    rawContentDatabaseColumnReferenceSchema,
  ])
  .array();

const outputRawContentSchema = z
  .union([rawContentTextElementSchema, rawContentInputReferenceSchema])
  .array();

export const flowInputSchemaMessageSchema = z.object({
  message: z.discriminatedUnion("type", [
    z
      .object({
        type: z.literal("message"),
        content: inputRawContentSchema,
      })
      .describe("The message of the inputs requirements gathering"),
    z.object({
      type: z.literal("end"),
      content: z.object({
        description: inputRawContentSchema.describe(
          "The description of the inputs schema. Must consist of text and reference parts. The reference parts must be used when mentioning a reference in the description.",
        ),
        inputSchema: z.string().describe(
          `The JSON schema for the inputs of the flow. Must follow these rules:
            - Property names must be in camelCase.
            - Schema must have \`$id\` property that follows the naming pattern \`/schemas/[FLOW_ID]/input\`.
            - Schema should be valid according to JSON Schema specification.
            - Properties should have clear, descriptive names that indicate their purpose.`,
        ),
        zodSchema: z.string().describe(
          `The Zod schema for validating the inputs. Must follow these rules:
            - The schema must be a raw Zod object schema without variable declarations.
            - The schema should be valid according to Zod specification.
            - Property names must be in camelCase.
            - Properties should have clear, descriptive names that indicate their purpose.`,
        ),
      }),
    }),
  ]),
});

export const flowOutputSchemaMessageSchema = z.object({
  message: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("message"),
      content: outputRawContentSchema,
    }),
    z.object({
      type: z.literal("end"),
      content: z.object({
        description: outputRawContentSchema.describe(
          "The description of the output schema. Must consist of text and reference parts. The reference parts must be used when mentioning a reference in the description.",
        ),
        outputSchema: z.string().describe(
          `The JSON schema for the output of the flow. Must follow these rules:
          - Schema must have \`$id\` property that follows the naming pattern \`/schemas/[FLOW_ID]/output\`.
          - Schema must have \`title\` property. It should be a descriptive noun like 'Customer' or 'Order' that represents the data and it is like a TypeScript type name. If no descriptive title applies, use \`undefined\` as the title value.
          - Property names must be in camelCase.
          - Schema should be valid according to JSON Schema specification.
            - Properties should have clear, descriptive names that indicate their purpose.`,
        ),
      }),
    }),
  ]),
});

export const functionRequirementsMessageSchema = z.object({
  message: z.discriminatedUnion("type", [
    z
      .object({
        type: z.literal("message"),
        content: rawContentSchema,
      })
      .describe("The message of the function requirements gathering"),
    z
      .object({
        type: z.literal("end"),
        content: z.object({
          inputSchema: z.string().describe(
            `The JSON schema for the input of the function. Must follow these rules:
              - Schema must have \`$id\` property that follows the naming pattern \`/schemas/[FUNCTION_ID]/input\`.
              - Must include $ref to specify input sources.
              - Property names must be in camelCase.
              - Schema should be valid according to JSON Schema specification.
              - Properties should have clear, descriptive names that indicate their purpose.`,
          ),
          outputSchema: z.string().describe(
            `The JSON schema for the output of the function. Must follow these rules:
              - Schema must have \`$id\` property that follows the naming pattern \`/schemas/[FUNCTION_ID]/output\`.
              - Schema must have \`title\` property. It should be a descriptive noun like 'Customer' or 'Order' that represents the data and it is like a TypeScript type name. If no descriptive title applies, use \`undefined\` as the title value.
              - Property names must be in camelCase.
              - Schema should be valid according to JSON Schema specification.
              - Properties should have clear, descriptive names that indicate their purpose.`,
          ),
          resources: z
            .object({
              id: z.string().describe("The ID of the resource"),
              name: z.string().describe("The name of the resource"),
              metadata: z.discriminatedUnion("type", [
                z.object({
                  type: z.literal("database"),
                  tables: z
                    .object({
                      name: z.string().describe("The name of the table"),
                      columns: z
                        .object({
                          name: z.string().describe("The name of the column"),
                          dataType: z
                            .string()
                            .describe("The SQL data type of the column"),
                        })
                        .array()
                        .describe("The columns of the table"),
                      relationships: z
                        .object({
                          columnName: z
                            .string()
                            .describe("The name of the column"),
                          referencedTable: z
                            .string()
                            .describe("The name of the referenced table"),
                          referencedColumn: z
                            .string()
                            .describe("The name of the referenced column"),
                        })
                        .array(),
                    })
                    .array()
                    .describe("The tables of the database"),
                }),
              ]),
              utilities: utilityFunctionReferenceSchema
                .omit({ docs: true })
                .array()
                .describe(
                  "The list of utilities that the resource provides and can be used to implement the function",
                ),
            })
            .array()
            .describe("The list of resources used in the function."),
          description: rawContentSchema.describe(
            "The description of the function.",
          ),
          logicalSteps: rawContentSchema.describe(
            `The logical steps of the function. Must be a clear, step-by-step description of what the function does. Each step should be concise but complete, focusing on one specific operation. Include:
                - Data transformations and calculations.
                - Database operations (queries, updates, etc.).
                - Specify the utilities that are used.
                - External service calls.
                - Business logic and conditional flows.
                - Return value preparation.`,
          ),
          edgeCases: z.string().describe(
            `The edge cases of the function. Must include:
              - Business logic edge cases (e.g. special conditions that require different handling).
              - Resource-related edge cases (e.g. missing or invalid resources).
              - Any other scenarios that require special handling.`,
          ),
          errorHandling: z.string().describe(
            `The error handling of the function. Must include:
              - How to handle database errors (e.g. connection issues, query failures).
              - How to handle external service errors (e.g. API timeouts, failed requests).
              - How to handle unexpected runtime errors.
              - What error messages to return to the user.
              - Whether to retry operations and how many times.
              - Input validation errors can be ignored as inputs are validated separately.`,
          ),
          dependencies: z
            .object({
              name: z.string().describe("The name of the npm package"),
              version: z
                .string()
                .optional()
                .describe("The version of the npm package (optional)"),
            })
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
