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

export const jsonSchema: z.ZodType<JsonSchema> = z.lazy(() =>
  z.object({
    // Basic schema properties
    type: z
      .enum([
        "string",
        "number",
        "integer",
        "boolean",
        "object",
        "array",
        "null",
      ])
      .optional(),
    title: z.string().optional(),
    description: z.string().optional(),

    // For objects
    required: z.array(z.string()).optional(),
    properties: z.record(jsonSchema).optional(),
    additionalProperties: z.union([z.boolean(), jsonSchema]).optional(),

    // For arrays
    items: z.union([jsonSchema, z.array(jsonSchema)]).optional(),
    minItems: z.number().int().positive().optional(),
    maxItems: z.number().int().positive().optional(),
    uniqueItems: z.boolean().optional(),

    // String validations
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().nonnegative().optional(),
    pattern: z.string().optional(),
    format: z.string().optional(),

    // Number validations
    minimum: z.number().optional(),
    maximum: z.number().optional(),
    exclusiveMinimum: z.number().optional(),
    exclusiveMaximum: z.number().optional(),
    multipleOf: z.number().positive().optional(),

    // Combiners
    oneOf: z.array(jsonSchema).optional(),
    anyOf: z.array(jsonSchema).optional(),
    allOf: z.array(jsonSchema).optional(),
    not: jsonSchema.optional(),

    // Conditionals
    if: jsonSchema.optional(),
    // biome-ignore lint/suspicious/noThenProperty: <explanation>
    then: jsonSchema.optional(),
    else: jsonSchema.optional(),

    // Enum
    enum: z
      .array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
      .optional(),

    // Schema metadata
    $id: z.string().optional(),
    $schema: z.string().optional(),
    $ref: z.string().optional(),
    definitions: z.record(jsonSchema).optional(),

    // Misc
    default: z.any().optional(),
    examples: z.array(z.any()).optional(),
  }),
);

export const functionReferenceSchema = z.object({
  id: z.string().describe("The ID of the function"),
  name: z.string().describe("The name of the function"),
});

export const resourceReferenceSchema = z.object({
  id: z.string().describe("The ID of the resource"),
  name: z.string().describe("The name of the resource"),
  resourceType: z
    .enum(["postgres", "mysql"])
    .describe("The type of the resource"),
});

export const databaseTableReferenceSchema = z.object({
  name: z.string().min(1).describe("The name of the table"),
  databaseId: z.string().min(1).describe("The ID of the database"),
});

export const databaseColumnReferenceSchema = z.object({
  name: z
    .string()
    .describe(
      "When referencing a database column, the name must follow the pattern '[TABLE_NAME].[COLUMN_NAME]' (e.g. 'users.email', 'orders.status').",
    ),
  dataType: z.string().describe("The SQL data type of the column"),
  databaseId: z.string().min(1).describe("The ID of the database"),
  tableName: z.string().min(1).describe("The name of the table"),
});

export const npmDependencySchema = z.object({
  type: z.enum(["development", "production"]),
  name: z.string().describe("The name of the npm package"),
  version: z.string().optional().describe("The version of the npm package"),
  reason: z.string().describe("The reason for the npm package"),
});

export const rawContentTextElementSchema = z.object({
  type: z.literal("text"),
  value: z
    .string()
    .describe("The value of the text. Should be valid markdown."),
});

export const rawContentVariableReferenceSchema = z.object({
  type: z.literal("reference"),
  referenceType: z.literal("variable"),
  name: z.string().describe("The name of the variable. Must be in camelCase."),
  dataType: dataTypeSchema.describe("The data type of the variable"),
});

export const rawContentFunctionReferenceSchema = z.object({
  type: z.literal("reference"),
  referenceType: z.literal("function"),
  name: z.string().describe("The name of the function"),
});

export const rawContentResourceReferenceSchema = z.object({
  type: z.literal("reference"),
  referenceType: z.literal("resource"),
  ...resourceReferenceSchema.shape,
});

export const rawContentDatabaseTableReferenceSchema = z.object({
  type: z.literal("reference"),
  referenceType: z.literal("database-table"),
  ...databaseTableReferenceSchema.omit({
    databaseId: true,
  }).shape,
});

export const rawContentDatabaseColumnReferenceSchema = z.object({
  type: z.literal("reference"),
  referenceType: z.literal("database-column"),
  ...databaseColumnReferenceSchema.omit({ databaseId: true, tableName: true })
    .shape,
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
    rawContentResourceReferenceSchema.describe(
      "The resource reference part of a message or description. Must be used when mentioning a resource in a message or description.",
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
          description: rawContentSchema.describe(
            "Comprehensive description of the function that includes: its main purpose, and any key features/capabilities. Should explain both WHAT it does and WHY it exists.",
          ),
          inputSchema: z.string().describe(
            `JSON schema for input structure including:
             - Required and optional properties
             - Types and formats for fields
             - Valid ranges/enums
             - Nested structures
             - Validation rules

             Properties must:
             - Use camelCase
             - Be descriptive (e.g., 'userId' not 'id')
             - Have root type: 'object'
             - Follow JSON Schema spec
             - Include descriptions`,
          ),
          outputSchema: z.string().describe(
            `JSON schema for output structure including:
             - Required and optional properties
             - Types and formats for fields
             - Valid ranges/enums
             - Nested structures
             - Validation rules

             Properties must:
             - Use camelCase
             - Be descriptive (e.g., 'userId' not 'id')
             - Have root type: 'object'
             - Follow JSON Schema spec
             - Include descriptions`,
          ),
          signature: z
            .string()
            .describe(
              "Complete function signature including type annotations and generics if used. Should match the exact implementation syntax of the target language.",
            ),
          parameters: z
            .string()
            .describe(
              "Detailed specification of each parameter including: type, format, validation rules, acceptable values, default values if any, and relationship to other parameters. Should explain any complex object structures or special handling requirements.",
            ),
          returns: z
            .string()
            .describe(
              "Specification of the return value including: type structure, and any conditional return formats based on input or processing state.",
            ),
          behavior: rawContentSchema.describe(
            "Step-by-step description of function behavior including: data validation, business logic, transformations, calculations, external service calls, error handling, and success/failure paths. Should detail edge cases and performance considerations. Must be valid markdown-like list. Use references for all the variables, functions, resources, etc.",
          ),
          errors: z
            .string()
            .describe(
              "List of all possible error messages (not error types) that the function can throw, with conditions that trigger each error, and any specific error handling requirements. Must be valid markdown list. Note: If the function does not throw any errors, this section can be omitted.",
            )
            .optional(),
          examples: z
            .string()
            .describe(
              "Multiple representative examples showing: typical usage patterns, edge cases, error scenarios, and complex use cases. Each example should include complete input values and expected output or error response.",
            ),
          resources: z
            .discriminatedUnion("type", [
              z
                .object({
                  id: z.string().describe("The ID of the resource"),
                  name: z.string().describe("The name of the resource"),
                  type: z
                    .literal("postgres")
                    .describe("The type of the resource"),
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
                })
                .describe("The resource of the postgres database"),
            ])
            .array()
            .optional()
            .describe(
              "The list of resources used in the function. PLEASE NOTE THAT RESOURCES WILL BE STATED IN THE CONTEXT. DON'T HALLUCINATE RESOURCES.",
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
              "The internal graph of the function of how the user-defined helper functions are connected to each other.",
            ),
          npmDependencies: npmDependencySchema
            .omit({
              version: true,
            })
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
