import { z } from "zod";

export const funcInternalGraphConnectionSchema = z.object({
  sourceOutput: z.string(),
  targetInput: z.string(),
});

export const funcInternalGraphEdgeSchema = z.object({
  sourceFuncId: z.string(),
  targetFuncId: z.string(),
  connections: z.array(funcInternalGraphConnectionSchema),
  createdAt: z.date(),
});

export const insertFuncInternalGraphEdgeSchema =
  funcInternalGraphEdgeSchema.omit({
    createdAt: true,
  });

export const funcInternalGraphSchema = z.object({
  funcId: z.string(),
  edges: z.array(funcInternalGraphEdgeSchema),
});

export const insertFuncInternalGraphSchema = funcInternalGraphSchema.omit({
  edges: true,
});
