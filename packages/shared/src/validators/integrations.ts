import { z } from "zod";

export const integrationTypeSchema = z.enum(["postgres", "mysql"]);

export const baseIntegrationSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  type: integrationTypeSchema,
  environmentVariables: z.string().array().optional().nullable(),
});

export const integrationSchema = baseIntegrationSchema.extend({
  dependencies: z.array(z.object({ name: z.string(), version: z.string() })),
});

export const integrationUtilsSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  implementation: z.string(),
  integrationId: z.string(),
});
