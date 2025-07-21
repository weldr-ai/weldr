import { z } from "zod";

const baseIntegrationTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const orpcIntegrationTemplateSchema =
  baseIntegrationTemplateSchema.extend({
    key: z.literal("orpc"),
    category: z.literal("backend"),
    allowMultiple: z.literal(false),
    dependencies: z.null(),
    variables: z.null(),
    options: z.null(),
  });

export const tanstackStartIntegrationTemplateSchema =
  baseIntegrationTemplateSchema.extend({
    key: z.literal("tanstack-start"),
    category: z.literal("frontend"),
    allowMultiple: z.literal(false),
    dependencies: z.null(),
    variables: z.null(),
    options: z.null(),
  });

export const postgresqlIntegrationTemplateSchema =
  baseIntegrationTemplateSchema.extend({
    key: z.literal("postgresql"),
    category: z.literal("database"),
    allowMultiple: z.literal(false),
    dependencies: z.tuple([z.literal("backend")]),
    variables: z.tuple([
      z.object({
        name: z.literal("DATABASE_URL"),
        isRequired: z.literal(true),
        source: z.literal("user"),
      }),
    ]),
    options: z.object({
      orm: z.tuple([z.literal("drizzle"), z.literal("prisma")]),
    }),
  });

export const betterAuthIntegrationTemplateSchema =
  baseIntegrationTemplateSchema.extend({
    key: z.literal("better-auth"),
    category: z.literal("authentication"),
    variables: z.array(
      z.object({
        name: z.literal("BETTER_AUTH_SECRET"),
        isRequired: z.literal(true),
        source: z.literal("system"),
      }),
    ),
    allowMultiple: z.literal(false),
    dependencies: z.tuple([z.literal("backend"), z.literal("database")]),
    options: z.object({
      socialProviders: z.tuple([
        z.literal("github"),
        z.literal("google"),
        z.literal("microsoft"),
      ]),
      plugins: z.tuple([
        z.literal("admin"),
        z.literal("oAuthProxy"),
        z.literal("openAPI"),
        z.literal("organization"),
        z.literal("stripe"),
      ]),
      emailVerification: z.boolean().default(false),
      emailAndPassword: z.boolean().default(true),
      stripeIntegration: z.boolean().default(false),
    }),
  });

export const integrationTemplateSchema = z.discriminatedUnion("key", [
  orpcIntegrationTemplateSchema,
  tanstackStartIntegrationTemplateSchema,
  postgresqlIntegrationTemplateSchema,
  betterAuthIntegrationTemplateSchema,
]);
