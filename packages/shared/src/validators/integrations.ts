import { z } from "zod";

export const createIntegrationSchema = z.object({
  name: z.string(),
  projectId: z.string(),
  integrationTemplateId: z.string(),
  environmentVariableMappings: z.array(
    z.object({
      envVarId: z.string(),
      configKey: z.string(),
    }),
  ),
});

export const updateIntegrationSchema = z.object({
  where: z.object({
    id: z.string(),
  }),
  payload: z.object({
    name: z.string().optional(),
    environmentVariableMappings: z
      .array(
        z.object({
          envVarId: z.string(),
          configKey: z.string(),
        }),
      )
      .optional(),
  }),
});
