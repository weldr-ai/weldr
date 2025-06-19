import { z } from "zod";
import { createTool } from "../utils/create-tool";

const setupIntegrationsInputSchema = z.object({
  integration: z
    .enum(["postgresql"])
    .array()
    .describe("The list of integrations to setup"),
});

export const setupIntegrationsTool = createTool({
  description: `Ask the user to setup integrations.
    MUST REPLY WITH A FRIENDLY MESSAGE TO THE USER WHILE INVOKING.
    If the user has already setup the integrations, do not ask them to setup again.
    If the user has not setup the integrations, ask them to setup the integrations before calling the coder tool.`,
  inputSchema: setupIntegrationsInputSchema,
  outputSchema: z.void(),
  execute: async ({ input, context }) => {
    const streamWriter = context.get("streamWriter");
    await streamWriter.write({
      type: "tool",
      toolName: "setupIntegrationsTool",
      toolArgs: input,
      toolResult: {
        status: "pending",
      },
    });
  },
});
