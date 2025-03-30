import type { TStreamableValue } from "@/types";
import type { Tx } from "@weldr/db";
import { tool } from "ai";
import type { createStreamableValue } from "ai/rsc";
import { z } from "zod";
import { insertMessages } from "../insert-messages";

export const setupResourceTool = tool({
  description:
    "Ask the user to setup a resource. MUST REPLY WITH A FRIENDLY MESSAGE TO THE USER WHILE INVOKING.",
  parameters: z.object({
    resource: z.enum(["postgres"]).describe("The type of resource to setup"),
  }),
  execute: async () => {
    return {
      status: "pending",
    };
  },
});

export async function setupResource({
  tx,
  chatId,
  userId,
  stream,
  toolArgs,
}: {
  tx: Tx;
  chatId: string;
  userId: string;
  stream: ReturnType<typeof createStreamableValue<TStreamableValue>>;
  toolArgs: z.infer<(typeof setupResourceTool)["parameters"]>;
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
            toolName: "setupResourceTool",
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

  stream.update({
    id: messageId,
    type: "tool",
    toolName: "setupResourceTool",
    toolArgs,
    toolResult: {
      status: "pending",
    },
  });
}
