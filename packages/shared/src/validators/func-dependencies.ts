import { z } from "zod";

export const funcDependencySchema = z.object({
  funcId: z.string(),
  dependencyFuncId: z.string(),
  createdAt: z.date(),
});

export const insertFuncDependencySchema = funcDependencySchema.omit({
  createdAt: true,
});
