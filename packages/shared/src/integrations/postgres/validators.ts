import { z } from "zod";

export const dbConfigSchema = z.object({
  host: z.string(),
  port: z.number(),
  database: z.string(),
  user: z.string(),
  password: z.string(),
});

export const databaseTableColumnSchema = z.object({
  name: z.string(),
  dataType: z.string(),
});

export const databaseRelationshipSchema = z.object({
  columnName: z.string(),
  referencedTable: z.string(),
  referencedColumn: z.string(),
});

export const databaseTableSchema = z.object({
  name: z.string(),
  columns: databaseTableColumnSchema.array(),
  relationships: databaseRelationshipSchema.array().optional(),
});
