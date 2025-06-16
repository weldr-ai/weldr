import { insertMessages } from "@/lib/insert-messages";
import type { AgentRuntimeContext } from "@/mastra";
import type { TStreamableValue } from "@/types";
import { createTool } from "@mastra/core";
import type { RuntimeContext } from "@mastra/core/runtime-context";
import { z } from "zod";

const setupIntegrationsInputSchema = z.object({
  integration: z
    .enum(["postgresql"])
    .array()
    .describe("The list of integrations to setup"),
});

export const setupIntegrationsTool = createTool({
  id: "setup-integrations-tool",
  description: `Ask the user to setup integrations.
    MUST REPLY WITH A FRIENDLY MESSAGE TO THE USER WHILE INVOKING.
    If the user has already setup the integrations, do not ask them to setup again.
    If the user has not setup the integrations, ask them to setup the integrations before calling the coder tool.`,
  inputSchema: setupIntegrationsInputSchema,
  outputSchema: z.void(),
  execute: async ({
    context,
    runtimeContext,
  }: {
    context: z.infer<typeof setupIntegrationsInputSchema>;
    runtimeContext: RuntimeContext<AgentRuntimeContext>;
  }) => {
    const version = runtimeContext.get("version");
    const user = runtimeContext.get("user");
    const streamWriter = runtimeContext.get(
      "streamWriter",
    ) as WritableStreamDefaultWriter<TStreamableValue>;

    const [messageId] = await insertMessages({
      input: {
        chatId: version.chatId,
        userId: user.id,
        messages: [
          {
            role: "tool",
            rawContent: {
              toolName: "setupIntegrationsTool",
              toolArgs: context,
              toolResult: {
                status: "pending",
              },
            },
          },
        ],
      },
    });

    if (!messageId) {
      throw new Error("Message ID not found");
    }

    streamWriter.write({
      type: "tool",
      toolName: "setupIntegrationsTool",
      toolArgs: context,
      toolResult: {
        status: "pending",
      },
    });
  },
});
