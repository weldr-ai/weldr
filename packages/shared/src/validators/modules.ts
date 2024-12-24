import { z } from "zod";
import { funcSchema } from "./funcs";

export const moduleSchema = z.object({
  id: z.string(),
  name: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  userId: z.string().nullable(),
  projectId: z.string().nullable(),
  funcs: funcSchema.array(),
});

export const insertModuleSchema = z.object({
  id: z.string().cuid2(),
  positionX: z.number(),
  positionY: z.number(),
  projectId: z.string().cuid2(),
});

export const updateModuleSchema = z.object({
  where: z.object({
    id: z.string(),
  }),
  payload: z.object({
    name: z
      .string()
      .min(1, {
        message: "Name is required.",
      })
      .regex(/^[A-Z][a-zA-Z0-9]*$/, {
        message:
          "Name must start with a capital letter and contain only letters and numbers.",
      })
      .optional(),
    description: z.string().optional(),
    positionX: z.number().optional(),
    positionY: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
  }),
});
