import { z } from "zod";

export const edgeSchema = z.object({
  id: z.string(),
  type: z.enum(["consumes", "requires"]),
  targetId: z.string(),
  localSourceId: z.string().nullable(),
  importedSourceId: z.string().nullable(),
  flowId: z.string(),
  createdAt: z.date(),
});

export const createEdgeSchema = edgeSchema.omit({ id: true, createdAt: true });
