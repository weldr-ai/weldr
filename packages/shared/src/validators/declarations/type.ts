import { z } from "zod";

export const typeSchema = z.object({
  type: z.literal("type"),
  name: z.string().describe("The name of the type"),
  description: z.string().describe("The description of the type"),
  metadata: z.unknown().optional().describe("Any metadata about the type"),
});
