import { z } from "zod";

export const versionSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  chatId: z.string(),
  message: z.string(),
  description: z.string(),
  status: z.enum([
    "pending",
    "planning",
    "coding",
    "deploying",
    "completed",
    "failed",
  ]),
  createdAt: z.date(),
  updatedAt: z.date(),
});
