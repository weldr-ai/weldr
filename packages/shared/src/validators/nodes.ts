import { z } from "zod";

export const nodeTypeSchema = z.enum(["endpoint", "db-model", "page"]);

export const nodeSchema = z.object({
  id: z.string(),
  type: nodeTypeSchema,
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
});
