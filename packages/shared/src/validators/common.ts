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

export const responsesSchema = z.record(
  z.string().regex(/^[0-9]{3}$/),
  z.object({
    description: z.string(),
    content: z
      .record(
        z.object({
          schema: z.object({
            type: z.enum([
              "string",
              "number",
              "integer",
              "boolean",
              "array",
              "object",
            ]),
            properties: z
              .record(
                z.object({
                  type: z.enum([
                    "string",
                    "number",
                    "integer",
                    "boolean",
                    "array",
                    "object",
                  ]),
                  description: z.string().optional(),
                }),
              )
              .optional(),
            items: z
              .object({
                type: z.enum([
                  "string",
                  "number",
                  "integer",
                  "boolean",
                  "object",
                ]),
              })
              .optional(),
          }),
        }),
      )
      .optional(),
  }),
);

export const jsonSchemaPropertySchema = z.object({
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

export const variableReferenceSchema = z.object({
  name: z.string().describe("The name of the variable. Must be in camelCase."),
  dataType: dataTypeSchema.describe("The data type of the variable"),
  refUri: z.string().describe("The URI of the variable reference"),
  required: z.boolean().describe("Whether the variable is required"),
  properties: z.record(z.string(), jsonSchema).optional(),
  itemsType: jsonSchema.optional(),
  sourceFuncId: z.string().optional(),
});

export const functionReferenceSchema = z.object({
  id: z.string().describe("The ID of the function"),
  name: z.string().describe("The name of the function"),
  inputSchema: z.string().describe("The input schema of the function"),
  outputSchema: z.string().describe("The output schema of the function"),
  description: z.string().describe("The description of the function"),
  logicalSteps: z.string().describe("The logical steps of the function"),
  edgeCases: z.string().describe("The edge cases of the function"),
  errorHandling: z.string().describe("The error handling of the function"),
  scope: z.enum(["local", "imported"]),
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
  name: z.string().min(1).describe("The name of the table"),
  database: databaseReferenceSchema.describe("The database of the table"),
  columns: z
    .object({
      name: z.string().min(1).describe("The name of the column"),
      dataType: z.string().min(1).describe("The SQL data type of the column"),
    })
    .array()
    .describe("The columns of the table"),
  relationships: z
    .object({
      columnName: z.string().min(1).describe("The name of the column"),
      referencedTable: z
        .string()
        .min(1)
        .describe("The name of the referenced table"),
      referencedColumn: z
        .string()
        .min(1)
        .describe("The name of the referenced column"),
    })
    .array()
    .optional(),
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
    .omit({ database: true })
    .describe("The table of the column"),
});

export const utilityFunctionReferenceSchema = z.object({
  id: z.string().min(1).describe("The ID of the utility function"),
  name: z.string().min(1).describe("The name of the utility function"),
  description: z
    .string()
    .min(1)
    .describe("The description of the utility function"),
  docs: z.string().min(1).describe("The documentation of the utility function"),
});

export const dependencySchema = z.object({
  name: z.string().describe("The name of the npm package"),
  version: z.string().optional().describe("The version of the npm package"),
});

export const rawContentTextElementSchema = z.object({
  type: z.literal("text"),
  value: z.string().describe("The value of the text"),
});

export const rawContentVariableReferenceSchema = z.object({
  type: z.literal("reference"),
  referenceType: z.literal("variable"),
  ...variableReferenceSchema.omit({
    refUri: true,
    properties: true,
    itemsType: true,
    sourceFuncId: true,
    required: true,
  }).shape,
});

export const rawContentFunctionReferenceSchema = z.object({
  type: z.literal("reference"),
  referenceType: z.literal("function"),
  name: z.string().describe("The name of the function"),
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

export const rawContentReferenceElementSchema = z.discriminatedUnion(
  "referenceType",
  [
    rawContentVariableReferenceSchema.describe(
      "The variable reference part of a message or description. Must be used when mentioning a variable in a message or description.",
    ),
    rawContentFunctionReferenceSchema.describe(
      "The function reference part of a message or description. Must be used when mentioning a function in a message or description.",
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
  ],
);

export const rawContentSchema = z
  .union([rawContentTextElementSchema, rawContentReferenceElementSchema])
  .array();

const flowInputRawContentSchema = z
  .union([
    rawContentTextElementSchema,
    rawContentVariableReferenceSchema,
    rawContentDatabaseReferenceSchema,
    rawContentDatabaseTableReferenceSchema,
    rawContentDatabaseColumnReferenceSchema,
  ])
  .array();

const outputRawContentSchema = z
  .union([rawContentTextElementSchema, rawContentVariableReferenceSchema])
  .array();

export const flowInputSchemaMessageSchema = z.object({
  message: z.discriminatedUnion("type", [
    z
      .object({
        type: z.literal("message"),
        content: flowInputRawContentSchema,
      })
      .describe("The message of the inputs requirements gathering"),
    z.object({
      type: z.literal("end"),
      content: z.object({
        description: flowInputRawContentSchema.describe(
          "The description of the inputs schema. Must consist of text and reference parts. The reference parts must be used when mentioning a reference in the description.",
        ),
        inputSchema: z.string().describe(
          `The JSON schema for the inputs of the flow. Must follow these rules:
            - Property names must be in camelCase.
            - Schema should be valid according to JSON Schema specification.
            - Properties should have clear, descriptive names that indicate their purpose.
            - Schema must be divided into body, query parameters and path parameters.`,
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
          - Schema must have \`title\` property. It should be a descriptive noun like 'Customer' or 'Order' that represents the data and it is like a TypeScript type name. If no descriptive title applies, use \`undefined\` as the title value.
          - Properties must have \`$ref\` property to specify input sources. Always include the \`$ref\` property. You will find it in the context.
          - Property names must be in camelCase.
          - Schema should be valid according to JSON Schema specification.
          - Properties should have clear, descriptive names that indicate their purpose.`,
        ),
      }),
    }),
  ]),
});

export const funcRequirementsMessageSchema = z.object({
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
          inputSchema: z
            .string()
            .describe(
              `The JSON schema for the input of the function. Must follow these rules:
                - Properties must have \`$ref\` property to specify input sources. Always include the \`$ref\` property. You will find it in the context.
                - Property names must be in camelCase.
                - Schema should be valid according to JSON Schema specification.
                - Properties should have clear, descriptive names that indicate their purpose.
                - Must be of type object.`,
            )
            .optional(),
          outputSchema: z
            .string()
            .describe(
              `The JSON schema for the output of the function. Must follow these rules:
                - Schema must have \`title\` property. It should be a descriptive noun like 'Customer' or 'Order' that represents the data and it is like a TypeScript type name. If no descriptive title applies, use \`undefined\` as the title value.
                - Property names must be in camelCase.
                - Schema should be valid according to JSON Schema specification.
                - Properties should have clear, descriptive names that indicate their purpose.
                - Must be of type object.`,
            )
            .optional(),
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
                        .array(
                          z.object({
                            columnName: z
                              .string()
                              .describe("The name of the column"),
                            referencedTable: z
                              .string()
                              .describe("The name of the referenced table"),
                            referencedColumn: z
                              .string()
                              .describe("The name of the referenced column"),
                          }),
                        )
                        .optional(),
                    })
                    .array()
                    .describe("The tables of the database"),
                }),
              ]),
              utilities: utilityFunctionReferenceSchema
                .omit({ docs: true })
                .array()
                .optional()
                .describe(
                  "The list of utilities that the resource provides and can be used to implement the function",
                ),
            })
            .array()
            .optional()
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
          extraUsedUtilities: z
            .object({
              local: z
                .string()
                .array()
                .optional()
                .describe(
                  "The list of local utilities that are used in the function.",
                ),
              imported: z
                .string()
                .array()
                .optional()
                .describe(
                  "The list of imported utilities that are used in the function.",
                ),
            })
            .optional()
            .describe(
              "The list of utilities that are used in the function but not listed in the `resources` section.",
            ),
          dependencies: dependencySchema
            .array()
            .optional()
            .describe(
              `The npm dependencies of the function.
              # Guidelines:
                - Don't include dependencies for SDKs that can be done with a simple HTTP request for external APIs.
                - Don't worry about specifying dependencies for the database provider.
                - Don't worry about the version of the packages.
                - Don't hallucinate non-existent dependencies.
                - If the task is simple, don't include unnecessary dependencies.
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
