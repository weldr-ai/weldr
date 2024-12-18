import { z } from "zod";
import { integrationSchema } from "./integrations";

export const resourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  userId: z.string(),
  projectId: z.string(),
  integrationId: z.string(),
  integration: integrationSchema,
});

export const insertResourceSchema = z.object({
  name: z
    .string()
    .min(1, {
      message: "Name is required.",
    })
    .regex(/^[a-zA-Z][a-zA-Z0-9]*$/, {
      message:
        "Must start with a letter and can only contain letters and numbers",
    }),
  description: z.string().optional(),
  projectId: z.string().min(1, {
    message: "Project is required.",
  }),
  integrationId: z.string().min(1, {
    message: "Integration is required.",
  }),
  environmentVariables: z
    .object({
      userKey: z.string(),
      mapTo: z.string(),
    })
    .array()
    .optional(),
});

export const updateResourceSchema = z.object({
  where: z.object({
    id: z.string(),
  }),
  payload: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    environmentVariables: z
      .object({
        userKey: z.string(),
        mapTo: z.string(),
      })
      .array()
      .optional(),
  }),
});
