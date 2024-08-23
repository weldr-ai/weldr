import { z } from "zod";

export const resourceProvidersSchema = z.enum(["postgres", "mysql"]);

export const resourceBaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
  workspaceId: z.string(),
});

export const databaseMetadataSchema = z.object({
  host: z.string(),
  port: z.number(),
  user: z.string(),
  password: z.string(),
  database: z.string(),
});

export const resourceMetadataSchema = databaseMetadataSchema;

export const postgresResourceSchema = resourceBaseSchema.extend({
  provider: z.literal("postgres"),
  metadata: databaseMetadataSchema,
});

export const mysqlResourceSchema = resourceBaseSchema.extend({
  provider: z.literal("mysql"),
  metadata: databaseMetadataSchema,
});

export const resourceSchema = z.discriminatedUnion("provider", [
  postgresResourceSchema,
  mysqlResourceSchema,
]);

export const baseInsertResourceSchema = z.object({
  name: z
    .string()
    .min(1, {
      message: "Name is required.",
    })
    .regex(/^[A-Z][a-zA-Z0-9]*$/, {
      message:
        "Name must start with a capital letter, followed by letters and numbers only",
    })
    .transform((name) => name.trim()),
  description: z.string().trim().optional(),
  workspaceId: z.string().min(1, {
    message: "Workspace is required.",
  }),
});

export const insertDatabaseMetadataSchema = z.object({
  host: z.string().min(1, {
    message: "Host is required.",
  }),
  port: z.string().regex(/^\d+$/, { message: "Port must be a number" }),
  user: z.string().min(1, {
    message: "User is required.",
  }),
  password: z.string().min(1, {
    message: "Password is required.",
  }),
  database: z.string().min(1, {
    message: "Database is required.",
  }),
});

export const insertPostgresResourceSchema = baseInsertResourceSchema.extend({
  provider: z.literal("postgres"),
  metadata: insertDatabaseMetadataSchema,
});

export const insertMysqlResourceSchema = baseInsertResourceSchema.extend({
  provider: z.literal("mysql"),
  metadata: insertDatabaseMetadataSchema,
});

export const insertResourceSchema = z.discriminatedUnion("provider", [
  insertPostgresResourceSchema,
  insertMysqlResourceSchema,
]);
