import type { TStreamableValue } from "@/types";
import { tool } from "ai";
import { z } from "zod";
import { insertMessages } from "../insert-messages";

export const setupIntegrationTool = tool({
  description:
    "Ask the user to setup an integration. MUST REPLY WITH A FRIENDLY MESSAGE TO THE USER WHILE INVOKING.",
  parameters: z.object({
    integration: z.enum(["postgresql"]).describe("The integration to setup"),
  }),
});

export const executeSetupIntegrationTool = async ({
  chatId,
  userId,
  streamWriter,
  args,
}: {
  chatId: string;
  userId: string;
  streamWriter: WritableStreamDefaultWriter<TStreamableValue>;
  args: z.infer<typeof setupIntegrationTool.parameters>;
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
            toolArgs: args,
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
    toolArgs: args,
    toolResult: {
      status: "pending",
    },
  });

  return {
    success: true,
    messageId,
  };
};
