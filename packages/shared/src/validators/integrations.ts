import { z } from "zod";

export const integrationTypeSchema = z.enum(["postgres", "mysql"]);
export const integrationCategorySchema = z.enum(["database"]);

export const integrationHelperFunctionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  implementation: z.string(),
  integrationId: z.string(),
  category: integrationCategorySchema.optional(),
});

export const integrationSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  category: integrationCategorySchema.optional(),
  type: integrationTypeSchema,
  environmentVariables: z.string().array().optional().nullable(),
  dependencies: z
    .array(z.object({ name: z.string(), version: z.string().optional() }))
    .optional()
    .nullable(),
  helperFunctions: integrationHelperFunctionSchema
    .array()
    .optional()
    .nullable(),
});
