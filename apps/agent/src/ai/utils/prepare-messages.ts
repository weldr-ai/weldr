import type { chatMessages } from "@weldr/db/schema";
import type { ToolMessageRawContent } from "@weldr/shared/types";
import type { CoreMessage } from "ai";

export function prepareMessages(
  messages: (typeof chatMessages.$inferSelect)[],
): CoreMessage[] {
  const result: CoreMessage[] = [];

  for (const message of messages) {
    if (message.role === "tool") {
      const toolInfo = message.rawContent as ToolMessageRawContent;
      result.push({
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: toolInfo.toolCallId,
            toolName: toolInfo.toolName,
            result: toolInfo.toolResult,
          },
        ],
      });
      continue;
    }

    if (!message.content || message.content?.trim().length === 0) {
      continue;
    }

    result.push({
      role: message.role,
      content: message.content,
    });
  }

  return result;
}
