import { z } from "zod";

export const dependentTypeSchema = z.enum(["function", "endpoint"]);

export const dependencySchema = z.object({
  dependentType: dependentTypeSchema,
  dependentId: z.string(),
  dependencyId: z.string(),
  createdAt: z.date(),
});

export const insertDependencySchema = dependencySchema.omit({
  createdAt: true,
});
