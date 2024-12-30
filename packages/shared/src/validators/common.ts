import { z } from "zod";
import { databaseTableSchema } from "../integrations/postgres/validators";
import { dataTypeSchema } from "./json-schema";

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

export const packageSchema = z.object({
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

export const requirementResourceSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    name: z.string(),
    type: z.literal("postgres"),
    tables: databaseTableSchema.array(),
  }),
]);
