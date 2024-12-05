import { z } from "zod";

export const testRunSchema = z.object({
  id: z.string(),
  input: z.record(z.string(), z.unknown()).nullable(),
  stdout: z.string().nullable(),
  stderr: z.string().nullable(),
  createdAt: z.date(),
  primitiveId: z.string().nullable(),
  flowId: z.string().nullable(),
});
