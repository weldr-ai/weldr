import { z } from "zod";

export const environmentVariableSchema = z.object({
  id: z.string(),
  key: z.string(),
  secretId: z.string(),
  workspaceId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  userId: z.string().nullable(),
});

export const insertEnvironmentVariableSchema = z.object({
  key: z
    .string()
    .regex(/^[A-Z][A-Z0-9_]*$/, "Key must be in SCREAMING_SNAKE_CASE format"),
  value: z.string().min(1, "Value is required"),
  workspaceId: z.string().min(1, "Workspace ID is required"),
});
