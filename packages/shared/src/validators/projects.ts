import { z } from "zod";
import { environmentVariableSchema } from "./environment-variables";

export const projectConfigSchema = z.object({
  server: z.boolean(),
  client: z.boolean(),
});

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  subdomain: z.string(),
  config: projectConfigSchema,
  initiatedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  userId: z.string().nullable(),
  environmentVariables: environmentVariableSchema.array(),
});

export const insertProjectSchema = z.object({
  chatId: z.string(),
  message: z.string(),
  attachments: z
    .object({
      key: z.string(),
      name: z.string(),
      contentType: z.string(),
      size: z.number(),
    })
    .array(),
});

export const updateProjectSchema = z.object({
  where: z.object({
    id: z.string(),
  }),
  payload: z.object({
    name: z
      .string()
      .transform((name) => name.replace(/\s+/g, " ").trim())
      .optional(),
    subdomain: z
      .string()
      .min(1, { message: "Subdomain is required" })
      .regex(/^[a-z0-9-]+$/, {
        message: "Must contain only lowercase letters, numbers, and hyphens",
      })
      .optional(),
  }),
});
