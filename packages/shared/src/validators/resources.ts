import { z } from "zod";
import { integrationSchema } from "./integrations";

export const resourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
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
    .regex(/^\S*$/, {
      message: "Cannot contain spaces.",
    })
    .transform((name) => name.trim()),
  description: z.string().trim().optional(),
  workspaceId: z.string().min(1, {
    message: "Workspace is required.",
  }),
  integrationId: z.string().min(1, {
    message: "Integration is required.",
  }),
  environmentVariables: z.record(z.string(), z.string()).optional(),
});
