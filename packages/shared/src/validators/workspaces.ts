import { z } from "zod";

export const workspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
});

export const insertWorkspaceSchema = z.object({
  name: z.string().transform((name) => name.replace(/\s+/g, " ").trim()),
  subdomain: z
    .string()
    .min(1, { message: "Subdomain is required" })
    .regex(/^[a-z0-9-]+$/, {
      message: "Must contain only lowercase letters, numbers, and hyphens",
    })
    .transform((subdomain) => subdomain.trim()),
  description: z.string().optional(),
});
