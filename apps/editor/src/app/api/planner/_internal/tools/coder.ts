import { tool } from "ai";
import { z } from "zod";

export const coderTool = tool({
  description: "Ask the coder agent to implement the request.",
  parameters: z.object({
    commitMessage: z
      .string()
      .min(1)
      .describe(
        "A short commit message for the changes made to the project. Must be concise and to the point. Must follow conventional commit message format. Must be in the present tense. Must be in the first person.",
      ),
    description: z
      .string()
      .min(1)
      .describe("Detailed description of the changes"),
  }),
});
