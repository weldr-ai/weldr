import { z } from "zod";
import {
  packageSchema,
  rawContentSchema,
  resourceMetadataSchema,
} from "./common";
import { integrationTypeSchema } from "./integrations";
import {
  contentTypeSchema,
  httpMethodSchema,
  openApiEndpointSpecSchema,
  parameterInSchema,
} from "./openapi";

export const httpMethodsSchema = z.enum([
  "get",
  "post",
  "put",
  "delete",
  "patch",
]);

export const endpointPathSchema = z
  .string()
  .min(1, {
    message: "Path is required",
  })
  .regex(
    /^\/(?:(?:[a-z0-9][a-z0-9-]*|\{[a-z][a-zA-Z0-9]*\})(?:\/(?:[a-z0-9][a-z0-9-]*|\{[a-z][a-zA-Z0-9]*\}))*)?$/,
    {
      message:
        "Path must start with '/' and can be followed by segments that are either lowercase alphanumeric with hyphens or variables in curly braces starting with lowercase (e.g. {userId}).",
    },
  );

export const insertEndpointSchema = z.object({
  id: z.string().cuid2(),
  positionX: z.number(),
  positionY: z.number(),
  projectId: z.string().cuid2(),
});

export const updateEndpointSchema = z.object({
  where: z.object({
    id: z.string(),
  }),
  payload: z.object({
    positionX: z.number().optional(),
    positionY: z.number().optional(),
  }),
});

export const createEndpointDefinitionSchema = z.object({
  where: z.object({
    id: z.string(),
  }),
  payload: z.object({
    code: z.string(),
    openApiSpec: openApiEndpointSpecSchema,
    resources: resourceMetadataSchema.array().optional(),
    packages: packageSchema.array().optional(),
    helperFunctionIds: z.string().array().optional(),
  }),
});

const parameterObjectSchema = z.object({
  name: z.string(),
  in: parameterInSchema,
  description: z.string().optional(),
  required: z.boolean().optional(),
  schema: z.string().describe(
    `JSON schema structure following JSON Schema 2020-12 spec including:
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
});

const requestBodyObjectSchema = z.object({
  description: z.string().optional(),
  required: z.boolean().optional(),
  content: z.record(
    contentTypeSchema,
    z.object({
      schema: z.string().describe(
        `JSON schema structure following JSON Schema 2020-12 spec including:
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
      example: z.any().optional(),
    }),
  ),
});

const responseObjectSchema = z.object({
  description: z.string().optional(),
  content: z.record(
    contentTypeSchema,
    z.object({
      schema: z.string().describe(
        `JSON schema structure following JSON Schema 2020-12 spec including:
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
      example: z.any().optional(),
    }),
  ),
});

export const endpointRequirementsMessageSchema = z.object({
  message: z.discriminatedUnion("type", [
    z
      .object({
        type: z.literal("message"),
        content: rawContentSchema,
      })
      .describe("The message of the endpoint requirements gathering"),
    z
      .object({
        type: z.literal("end"),
        content: z.object({
          openApiSpec: z.object({
            path: z
              .string()
              .describe("The URL path pattern (e.g., '/users/{userId}/posts')"),
            method: httpMethodSchema,
            summary: z
              .string()
              .describe(
                "A short summary of what the operation does (1-2 lines)",
              ),
            description: z
              .string()
              .describe(
                "A verbose explanation of the operation's behavior. Can include markdown formatting and detailed information about edge cases, notes, and examples.",
              ),
            tags: z
              .array(z.string())
              .optional()
              .describe(
                "Tags for organizing and categorizing the endpoint (e.g., ['users', 'admin'])",
              ),
            parameters: z
              .array(parameterObjectSchema)
              .optional()
              .describe(
                "List of parameters that can be used with this endpoint",
              ),
            requestBody: requestBodyObjectSchema
              .optional()
              .describe(
                "Specification of the request body, if this endpoint accepts one",
              ),
            responses: z
              .record(responseObjectSchema)
              .describe(
                "Possible responses indexed by HTTP status code (e.g., '200', '400', '404')",
              ),
            security: z
              .record(z.array(z.string()))
              .array()
              .optional()
              .describe("Security requirements for this specific endpoint"),
          }),
          helperFunctionIds: z
            .string()
            .array()
            .optional()
            .describe(
              "Names of helper functions that can be used to implement this endpoint",
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
      .describe("The last message of the endpoint requirements gathering"),
  ]),
});
