import type {
  ChatMessage,
  ToolMessageRawContent,
  VersionMessageRawContent,
} from "@weldr/shared/types";
import type { CoreMessage } from "ai";

export function convertMessagesToCoreMessages(
  messages: (Omit<ChatMessage, "createdAt"> & { content: string | null })[],
): CoreMessage[] {
  const result: CoreMessage[] = [];

  for (const message of messages) {
    if (message.role === "tool") {
      const toolInfo = message.rawContent as ToolMessageRawContent;

      if (
        toolInfo.toolName === "setupIntegration" &&
        toolInfo.toolResult?.status !== "pending"
      ) {
        result.push({
          role: "user",
          content: `Setting up ${toolInfo.toolArgs?.integration} has been ${toolInfo.toolResult?.status}.`,
        });
      } else if (toolInfo.toolName === "initializeProject") {
        result.push({
          role: "assistant",
          content: `Initialized project ${toolInfo.toolArgs?.name} with ${toolInfo.toolArgs?.requirements}`,
        });
      } else if (toolInfo.toolName === "implement") {
        result.push({
          role: "assistant",
          content: `Implemented ${toolInfo.toolArgs?.requirements}`,
        });
      }

      continue;
    }

    if (message.role === "version") {
      const version = message.rawContent as VersionMessageRawContent;
      result.push({
        role: "assistant",
        content: `Created #${version.versionNumber} ${version.versionMessage}`,
      });
      continue;
    }

    if (message.content === null) continue;

    result.push({
      role: message.role,
      content: message.content,
    });
  }

  return result;
}
