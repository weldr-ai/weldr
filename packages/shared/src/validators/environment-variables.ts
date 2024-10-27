import { z } from "zod";

export const environmentVariableSchema = z.object({
  id: z.string(),
  key: z.string(),
  value: z.string(),
  viewable: z.boolean(),
  workspaceId: z.string(),
  createdBy: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const insertEnvironmentVariableSchema = z.object({
  key: z.string(),
  value: z.string(),
  viewable: z.boolean(),
  workspaceId: z.string(),
});
