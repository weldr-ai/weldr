import { z } from "zod";
import { createTool } from "../utils/create-tool";

const startCoderInputSchema = z.object({
  commitMessage: z.string(),
  description: z.string(),
});

const startCoderOutputSchema = z.object({
  success: z.literal(true),
  commitMessage: z.string(),
  description: z.string(),
});

export const startCoderTool = createTool({
  description:
    "Call the coder agent to start implementing the user's request. This will actually do the coding.",
  inputSchema: startCoderInputSchema,
  outputSchema: startCoderOutputSchema,
  execute: async ({ input }) => {
    return {
      success: true,
      commitMessage: input.commitMessage,
      description: input.description,
    };
  },
});
