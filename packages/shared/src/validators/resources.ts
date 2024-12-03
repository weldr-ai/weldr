import { z } from "zod";
import { integrationSchema } from "./integrations";

export const resourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  userId: z.string(),
  workspaceId: z.string(),
  integrationId: z.string(),
  integration: integrationSchema,
});

export const insertResourceSchema = z.object({
  name: z
    .string()
    .min(1, {
      message: "Name is required.",
    })
    .regex(/^[A-Z]/, {
      message: "Must start with an uppercase letter",
    })
    .regex(/^[A-Z][a-zA-Z0-9]*$/, {
      message: "Can only contain letters and numbers",
    }),
  description: z.string().optional(),
  workspaceId: z.string().min(1, {
    message: "Workspace is required.",
  }),
  integrationId: z.string().min(1, {
    message: "Integration is required.",
  }),
  environmentVariables: z
    .object({ mappedKey: z.string(), key: z.string(), value: z.string() })
    .array()
    .optional(),
});
