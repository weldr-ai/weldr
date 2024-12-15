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
  helperFunctions: z
    .object({
      id: z.string().describe("The ID of the helper function"),
      name: z.string().describe("The name of the helper function"),
      description: z
        .string()
        .describe("The description of the helper function"),
    })
    .array()
    .describe("The helper functions of the database"),
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

export const integrationHelperFunctionReferenceSchema = z.object({
  id: z.string().min(1).describe("The ID of the helper function"),
  name: z.string().min(1).describe("The name of the helper function"),
  description: z
    .string()
    .min(1)
    .describe("The description of the helper function"),
  docs: z.string().min(1).describe("The documentation of the helper function"),
});

export const npmDependencySchema = z.object({
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
  ...databaseReferenceSchema.omit({ helperFunctions: true }).shape,
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
                - Specify the helper functions that are used.
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
          helperFunctionIds: z
            .string()
            .array()
            .optional()
            .describe(
              "The IDs of the helper functions to use in the implementation.",
            ),
          internalGraphEdges: z
            .array(
              z.object({
                targetFuncId: z
                  .string()
                  .describe(
                    "The ID of the target function. This is the function that will take the output of the source function as input.",
                  ),
                sourceFuncId: z
                  .string()
                  .describe(
                    "The ID of the source function. This is the function that will provide the output to the target function.",
                  ),
                connections: z
                  .array(
                    z.object({
                      sourceOutput: z
                        .string()
                        .describe(
                          "The output of the source function. This is the name of the output property that will be passed to the target function.",
                        ),
                      targetInput: z
                        .string()
                        .describe(
                          "The input of the target function. This is the name of the input property that will be passed to the target function.",
                        ),
                    }),
                  )
                  .describe(
                    "The connections between the source and target function. This is the list of inputs and outputs that are passed between the source and target function.",
                  ),
              }),
            )
            .optional()
            .describe(
              "The internal graph of the function of how the helper functions are connected to each other.",
            ),
          npmDependencies: npmDependencySchema
            .array()
            .optional()
            .describe(
              `The npm dependencies that the Typescript function will use in the implementation.
              # Guidelines:
                - Don't include dependencies for SDKs that can be done with a simple HTTP request for external APIs.
                - Don't worry about specifying dependencies for the database provider.
                - Don't worry about the version of the packages.
                - Don't hallucinate non-existent dependencies.
                - Must be a valid npm package name.
                - Don't use suspicious packages.
                - Don't use packages that are not maintained anymore.
                - Don't use packages that have been deprecated recently.
                - Don't use packages with known security vulnerabilities.
                - Don't use packages that are not popular.
                - Don't use packages that are not well-documented.`,
            ),
        }),
      })
      .describe("The last message of the function requirements gathering"),
  ]),
});
