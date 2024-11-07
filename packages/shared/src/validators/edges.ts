import { z } from "zod";

export const edgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  flowId: z.string(),
  createdBy: z.string().nullable(),
});

export const insertEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  flowId: z.string(),
});
