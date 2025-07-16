import { z } from "zod";

export const integrationCategorySchema = z.enum([
  "backend",
  "frontend",
  "database",
  "authentication",
]);

export const databaseIntegrationKeySchema = z.enum(["postgresql"]);
export const authenticationIntegrationKeySchema = z.enum(["better-auth"]);

export const integrationKeySchema = z.union([
  z.literal("backend"),
  z.literal("frontend"),
  databaseIntegrationKeySchema,
  authenticationIntegrationKeySchema,
]);

export const variableSourceTypeSchema = z.enum([
  "user_provided",
  "system_generated",
]);

export const integrationTemplateVariableSchema = z.object({
  id: z.string(),
  pluginTemplateId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  type: variableSourceTypeSchema,
  isRequired: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const integrationTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  category: integrationCategorySchema,
  key: integrationKeySchema,
  version: z.string(),
  isSystemManaged: z.boolean(),
  allowMultiple: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  variables: z.array(integrationTemplateVariableSchema).optional(),
});

export const integrationTemplateWithVariablesSchema =
  integrationTemplateSchema.extend({
    variables: z.array(integrationTemplateVariableSchema),
  });

export const integrationSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  createdAt: z.date(),
  projectId: z.string(),
  userId: z.string(),
  integrationTemplateId: z.string(),
  integrationTemplate: integrationTemplateSchema.optional(),
});

export const integrationEnvironmentVariableMappingSchema = z.object({
  envVarId: z.string(),
  configKey: z.string(),
});

export const createIntegrationSchema = z.object({
  name: z.string().min(1).optional(),
  projectId: z.string().min(1),
  integrationTemplateId: z.string().min(1),
  environmentVariableMappings: z.array(
    integrationEnvironmentVariableMappingSchema,
  ),
  variableValues: z.record(z.string(), z.unknown()).optional(),
});

export const updateIntegrationSchema = z.object({
  where: z.object({
    id: z.string().min(1),
  }),
  payload: z.object({
    name: z.string().min(1).optional(),
    environmentVariableMappings: z
      .array(integrationEnvironmentVariableMappingSchema)
      .optional(),
    variableValues: z.record(z.string(), z.unknown()).optional(),
  }),
});
