import { z } from "zod";

export const edgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  sourceHandle: z.string().nullable().optional(),
  target: z.string(),
  targetHandle: z.string().nullable().optional(),
  flowId: z.string(),
  createdBy: z.string(),
});

export const insertEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  sourceHandle: z.string().nullable().optional(),
  target: z.string(),
  targetHandle: z.string().nullable().optional(),
  flowId: z.string(),
});
