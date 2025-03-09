import { z } from "zod";

export const otherSchema = z.object({
  type: z.literal("other"),
  declType: z.string().describe("The type of the declaration"),
  name: z.string().describe("The name of the declaration"),
  description: z
    .string()
    .describe(
      "Very detailed description of the declaration, its purpose, how it should be used, and any other relevant information",
    ),
});
