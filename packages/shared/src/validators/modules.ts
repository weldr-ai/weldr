import { z } from "zod";
import { funcSchema } from "./funcs";

export const moduleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  userId: z.string().nullable(),
  projectId: z.string().nullable(),
  funcs: funcSchema.array(),
});

export const insertModuleSchema = z.object({
  name: z
    .string()
    .min(1, {
      message: "Name is required.",
    })
    .regex(/^[A-Z]/, {
      message: "Name must start with a capital letter.",
    })
    .regex(/^[A-Za-z0-9]+$/, {
      message:
        "Name can only contain letters and numbers, no spaces or special characters.",
    }),
  description: z.string().optional(),
  projectId: z.string().min(1, {
    message: "Project is required.",
  }),
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
      .optional(),
    description: z.string().optional(),
  }),
});
