import { z } from "zod";

export const integrationKeySchema = z.enum([
  "orpc",
  "tanstack-start",
  "postgresql",
  "better-auth",
]);

export const integrationStatusSchema = z.enum([
  "pending",
  "requires_configuration",
  "installed",
  "failed",
]);

const baseIntegrationSchema = z.object({
  id: z.string(),
  key: integrationKeySchema,
  name: z.string().optional(),
  status: integrationStatusSchema,
  createdAt: z.date(),
  projectId: z.string(),
  userId: z.string(),
  integrationTemplateId: z.string(),
});

export const honoIntegrationSchema = baseIntegrationSchema.extend({
  key: z.literal("orpc"),
  options: z.null(),
});

export const tanstackStartIntegrationSchema = baseIntegrationSchema.extend({
  key: z.literal("tanstack-start"),
  options: z.null(),
});

export const postgresqlIntegrationSchema = baseIntegrationSchema.extend({
  key: z.literal("postgresql"),
  options: z.object({
    orm: z.enum(["drizzle", "prisma"]).default("drizzle"),
  }),
});

export const betterAuthIntegrationSchema = baseIntegrationSchema.extend({
  key: z.literal("better-auth"),
  options: z.object({
    socialProviders: z.enum(["github", "google", "microsoft"]).array(),
    plugins: z
      .enum(["admin", "oAuthProxy", "openAPI", "organization", "stripe"])
      .array(),
    emailVerification: z.boolean().default(false),
    emailAndPassword: z.boolean().default(true),
    stripeIntegration: z.boolean().default(false),
  }),
});

export const integrationSchema = z.discriminatedUnion("key", [
  honoIntegrationSchema,
  tanstackStartIntegrationSchema,
  postgresqlIntegrationSchema,
  betterAuthIntegrationSchema,
]);

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
