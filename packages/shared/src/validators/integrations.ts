import { z } from "zod";

export const integrationTypeSchema = z.enum(["postgres", "mysql"]);

export const integrationUtilsSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  implementation: z.string(),
  integrationId: z.string(),
});

export const integrationSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  type: integrationTypeSchema,
  environmentVariables: z.string().array().optional().nullable(),
  dependencies: z.array(z.object({ name: z.string(), version: z.string() })),
  utils: integrationUtilsSchema.array().optional().nullable(),
});
