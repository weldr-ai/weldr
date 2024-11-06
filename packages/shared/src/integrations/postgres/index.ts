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
  columns: z.array(databaseTableColumnSchema),
  relationships: z.array(databaseRelationshipSchema),
});

export type DbConfig = z.infer<typeof dbConfigSchema>;
export type DatabaseStructure = z.infer<typeof databaseTableSchema>[];
export type DatabaseTable = z.infer<typeof databaseTableSchema>;
export type DatabaseRelationship = z.infer<typeof databaseRelationshipSchema>;
