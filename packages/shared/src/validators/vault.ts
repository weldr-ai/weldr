import { z } from "zod";

export const secretSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  secret: z.string(),
});
