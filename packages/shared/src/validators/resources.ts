import { z } from "zod";

export const resourceProvidersSchema = z.enum(["postgres"]);

export const resourceBaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
  workspaceId: z.string(),
});

export const postgresMetadataSchema = z.object({
  host: z.string(),
  port: z.number(),
  user: z.string(),
  password: z.string(),
  database: z.string(),
});

export const postgresResourceSchema = resourceBaseSchema.extend({
  provider: z.literal("postgres"),
  metadata: postgresMetadataSchema,
});

export const resourceMetadataSchema = postgresMetadataSchema;

export const resourceSchema = z.discriminatedUnion("provider", [
  postgresResourceSchema,
]);

export const insertResourceBaseSchema = z.object({
  name: z
    .string()
    .min(1, {
      message: "Name is required.",
    })
    .transform((name) => name.replace(/\s+/g, " ").trim()),
  description: z.string().trim().optional(),
  workspaceId: z.string().min(1, {
    message: "Workspace is required.",
  }),
});

export const insertPostgresResourceSchema = insertResourceBaseSchema.extend({
  provider: z.literal("postgres"),
  metadata: z.object({
    host: z.string().min(1, {
      message: "Host is required.",
    }),
    port: z.preprocess(
      (val) => (typeof val === "string" ? Number.parseInt(val, 10) : val),
      z.number().int().positive({
        message: "Port must be a positive integer.",
      }),
    ),
    user: z.string().min(1, {
      message: "User is required.",
    }),
    password: z.string().min(1, {
      message: "Password is required.",
    }),
    database: z.string().min(1, {
      message: "Database is required.",
    }),
  }),
});

export const insertResourceSchema = z.discriminatedUnion("provider", [
  insertPostgresResourceSchema,
]);
