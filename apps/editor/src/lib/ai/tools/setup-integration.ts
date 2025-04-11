import type { TStreamableValue } from "@/types";
import type { Tx } from "@weldr/db";
import { tool } from "ai";
import { z } from "zod";
import { insertMessages } from "../insert-messages";

export const setupIntegrationTool = tool({
  description:
    "Ask the user to setup an integration. MUST REPLY WITH A FRIENDLY MESSAGE TO THE USER WHILE INVOKING.",
  parameters: z.object({
    integration: z.enum(["postgres"]).describe("The integration to setup"),
  }),
  execute: async () => {
    return {
      status: "pending",
    };
  },
});

export async function setupIntegration({
  tx,
  chatId,
  userId,
  streamWriter,
  toolArgs,
}: {
  tx: Tx;
  chatId: string;
  userId: string;
  streamWriter: WritableStreamDefaultWriter<TStreamableValue>;
  toolArgs: z.infer<(typeof setupIntegrationTool)["parameters"]>;
}) {
  const [messageId] = await insertMessages({
    tx,
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
}
