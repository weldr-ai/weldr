import { z } from "zod";

export const canvasNodeTypeSchema = z.enum(["preview", "declaration-v1"]);

export const canvasNodeSchema = z.object({
  id: z.string(),
  type: canvasNodeTypeSchema,
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
});
