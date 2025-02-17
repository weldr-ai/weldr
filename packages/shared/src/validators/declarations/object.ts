import { z } from "zod";

export const objectSchema = z.object({
  type: z.literal("object"),
  name: z.string().describe("The name of the object"),
  description: z.string().describe("The description of the object"),
  metadata: z.any().optional().describe("Any metadata about the object"),
});
