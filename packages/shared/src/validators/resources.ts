import { z } from "zod";

export const resourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
  workspaceId: z.string(),
  integrationId: z.string(),
});

export const insertResourceSchema = z.object({
  name: z
    .string()
    .min(1, {
      message: "Name is required.",
    })
    .regex(/^[A-Z][a-zA-Z0-9]*$/, {
      message:
        "Name must start with a capital letter, followed by letters and numbers only",
    })
    .transform((name) => name.trim()),
  description: z.string().trim().optional(),
  workspaceId: z.string().min(1, {
    message: "Workspace is required.",
  }),
  integrationId: z.string().min(1, {
    message: "Integration is required.",
  }),
});
