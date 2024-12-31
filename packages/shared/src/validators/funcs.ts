import { z } from "zod";
import {
  packageSchema,
  rawContentSchema,
  requirementResourceSchema,
} from "./common";
import { conversationSchema } from "./conversations";
import { dependencySchema } from "./dependencies";
import { integrationTypeSchema } from "./integrations";
import { jsonSchema } from "./json-schema";
import { testRunSchema } from "./test-runs";

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
  resources: requirementResourceSchema.array().optional().nullable(),
  packages: packageSchema.array().optional().nullable(),
  userId: z.string().nullable(),
  conversationId: z.string().nullable(),
  canRun: z.boolean().optional(),
  projectId: z.string(),
  conversation: conversationSchema,
  testRuns: testRunSchema.array(),
  dependencies: dependencySchema.array(),
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
    resources: requirementResourceSchema.array().optional().nullable(),
    packages: packageSchema.array().optional().nullable(),
  }),
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
          name: z
            .string()
            .describe("A short name for the function. Must be camelCase."),
          description: rawContentSchema.describe(
            "Comprehensive description of the function that includes: its main purpose, and any key features/capabilities. Should explain both WHAT it does and WHY it exists.",
          ),
          inputSchema: z.string().describe(
            `JSON schema for input structure following JSON Schema 2020-12 spec including:
             - Required and optional properties using "$schema": "https://json-schema.org/draft/2020-12/schema"
             - Types and formats for fields with proper "type" and "format" keywords
             - Valid ranges/enums using "minimum", "maximum", "enum", "pattern" etc.
             - Nested structures with "properties", "items", "additionalProperties"
             - Validation rules using keywords like "minLength", "maxLength", "required"
             - Schema metadata with "$id", "title", "description"

             Properties must:
             - Use camelCase naming convention
             - Be descriptive
             - Have root type: 'object' with "type": "object"
             - Follow JSON Schema 2020-12 specification
             - Include descriptions using "description" keyword for all properties
             - Use appropriate formats (e.g., "date-time", "email", "uri")
             - Define proper "contentMediaType" and "contentEncoding" where applicable`,
          ),
          outputSchema: z.string().describe(
            `JSON schema for output structure following JSON Schema 2020-12 spec including:
             - Required and optional properties using "$schema": "https://json-schema.org/draft/2020-12/schema"
             - Types and formats for fields with proper "type" and "format" keywords
             - Valid ranges/enums using "minimum", "maximum", "enum", "pattern" etc.
             - Nested structures with "properties", "items", "additionalProperties"
             - Validation rules using keywords like "minLength", "maxLength", "required"
             - Schema metadata with "$id", "title", "description"

             Properties must:
             - Use camelCase naming convention
             - Be descriptive
             - Have root type: 'object' with "type": "object"
             - Follow JSON Schema 2020-12 specification
             - Include descriptions using "description" keyword for all properties
             - Use appropriate formats (e.g., "date-time", "email", "uri")
             - Define proper "contentMediaType" and "contentEncoding" where applicable`,
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
              `The list of resources used in the function. Here is a list of valid resources: ${Object.values(
                integrationTypeSchema.options,
              ).join(", ")}`,
            ),
          helperFunctionIds: z
            .string()
            .array()
            .optional()
            .describe(
              "The IDs of the helper functions to use in the implementation.",
            ),
          packages: packageSchema
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
