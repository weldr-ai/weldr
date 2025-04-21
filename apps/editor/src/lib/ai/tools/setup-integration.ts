import type { TStreamableValue } from "@/types";
import { tool } from "ai";
import { z } from "zod";
import { insertMessages } from "../insert-messages";

export const setupIntegrationTool = tool({
  description:
    "Ask the user to setup an integration. MUST REPLY WITH A FRIENDLY MESSAGE TO THE USER WHILE INVOKING.",
  parameters: z.object({
    integration: z.enum(["postgres"]).describe("The integration to setup"),
  }),
});

export const executeSetupIntegrationTool = async ({
  chatId,
  userId,
  toolArgs,
  streamWriter,
}: {
  chatId: string;
  userId: string;
  toolArgs: z.infer<typeof setupIntegrationTool.parameters>;
  streamWriter: WritableStreamDefaultWriter<TStreamableValue>;
}) => {
  const [messageId] = await insertMessages({
    input: {
      chatId,
      userId,
      messages: [
        {
          role: "tool",
          rawContent: {
            toolName: "setupIntegrationTool",
            toolArgs,
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

  await streamWriter.write({
    id: messageId,
    type: "tool",
    toolName: "setupIntegrationTool",
    toolArgs,
    toolResult: {
      status: "pending",
    },
  });
};
