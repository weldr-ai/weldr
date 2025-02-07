import { z } from "zod";
import { environmentVariableSchema } from "./environment-variables";

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  subdomain: z.string(),
  description: z.string().nullable(),
  thumbnail: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  userId: z.string().nullable(),
  environmentVariables: environmentVariableSchema.array(),
});

export const insertProjectSchema = z.object({
  message: z.string(),
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
    description: z.string().optional(),
  }),
});
