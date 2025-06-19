import type {
  addMessageItemSchema,
  assistantMessageContentSchema,
} from "@weldr/shared/validators/chats";
import type { CoreAssistantMessage, CoreToolMessage } from "ai";
import type { z } from "zod";
import { insertMessages } from "./insert-messages";

export async function saveResponseMessages({
  chatId,
  userId,
  messages,
  type,
}: {
  chatId: string;
  userId: string;
  messages: (CoreAssistantMessage | CoreToolMessage)[];
  type: "internal" | "public";
}) {
  const messagesToSave = messages.reduce(
    (acc, message) => {
      if (message.role === "assistant") {
        acc.push({
          type,
          role: message.role,
          content: Array.isArray(message.content)
            ? message.content.reduce(
                (acc, part) => {
                  switch (part.type) {
                    case "text":
                      acc.push({ type: "text", text: part.text });
                      break;
                    case "reasoning":
                      acc.push({ type: "reasoning", text: part.text });
                      break;
                    case "redacted-reasoning":
                      acc.push({ type: "redacted-reasoning", data: part.data });
                      break;
                    case "tool-call":
                      acc.push({
                        type: "tool-call",
                        toolCallId: part.toolCallId,
                        toolName: part.toolName,
                        args: part.args as Record<string, unknown>,
                      });
                      break;
                  }
                  return acc;
                },
                [] as z.infer<typeof assistantMessageContentSchema>[],
              )
            : [{ type: "text", text: message.content }],
        });
      } else if (message.role === "tool") {
        acc.push({
          type: message.content.some(
            (part) => part.toolName === "setupIntegrations",
          )
            ? "public"
            : "internal",
          role: message.role,
          content: message.content.map((part) => ({
            type: "tool-result",
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            result: part.result,
            isError: part.isError,
          })),
        });
      }
      return acc;
    },
    [] as z.infer<typeof addMessageItemSchema>[],
  );
  await insertMessages({
    input: {
      chatId,
      userId,
      messages: messagesToSave,
    },
  });
}
